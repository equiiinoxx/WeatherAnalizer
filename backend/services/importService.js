const fs = require('fs');
const { parse } = require('csv-parse');
const pool = require('../config/db');

/**
 * Standardize and sanitize field names
 */
function normalizeHeader(key) {
  const clean = key.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (['observationdate', 'date', 'obsdate', 'datetime'].includes(clean)) return 'observation_date';
  if (['location', 'city', 'station', 'place'].includes(clean)) return 'location';
  if (['temperature', 'temp', 'avgtemp', 'temperaturec'].includes(clean)) return 'temperature';
  if (['humidity', 'hum', 'relativehumidity'].includes(clean)) return 'humidity';
  if (['rainfall', 'precipitation', 'rain', 'precipmm'].includes(clean)) return 'rainfall';
  return clean;
}

/**
 * Validates a single row against historical weather data domain rules
 * Returns { isValid, errors, cleanedRecord }
 */
function validateRow(rawRow, rowNumber) {
  const errors = [];
  const normalized = {};

  for (const [key, val] of Object.entries(rawRow)) {
    normalized[normalizeHeader(key)] = typeof val === 'string' ? val.trim() : val;
  }

  // 1. Validate observation_date
  let observationDate = null;
  const rawDate = normalized.observation_date;

  if (!rawDate) {
    errors.push({
      field_name: 'observation_date',
      issue_description: 'Observation date is missing',
      raw_value: String(rawDate ?? '')
    });
  } else {
    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push({
        field_name: 'observation_date',
        issue_description: 'Invalid date format (expected YYYY-MM-DD or standard ISO date)',
        raw_value: String(rawDate)
      });
    } else {
      // Must not be in the future (strictly historical observation)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (parsedDate > today) {
        errors.push({
          field_name: 'observation_date',
          issue_description: 'Observation date cannot be in the future (historical data only)',
          raw_value: String(rawDate)
        });
      } else {
        observationDate = parsedDate.toISOString().split('T')[0];
      }
    }
  }

  // 2. Validate location
  const location = normalized.location;
  if (!location || location.length === 0) {
    errors.push({
      field_name: 'location',
      issue_description: 'Location name is required and cannot be empty',
      raw_value: String(location ?? '')
    });
  } else if (location.length > 100) {
    errors.push({
      field_name: 'location',
      issue_description: 'Location name exceeds maximum allowed length of 100 characters',
      raw_value: String(location)
    });
  }

  // 3. Validate temperature (can be null/empty, but if present must be within [-60, 60] Celsius)
  let temperature = null;
  const rawTemp = normalized.temperature;
  if (rawTemp !== undefined && rawTemp !== null && rawTemp !== '') {
    const num = Number(rawTemp);
    if (isNaN(num)) {
      errors.push({
        field_name: 'temperature',
        issue_description: 'Temperature must be a valid numeric decimal value',
        raw_value: String(rawTemp)
      });
    } else if (num < -60 || num > 60) {
      errors.push({
        field_name: 'temperature',
        issue_description: `Temperature value ${num}°C exceeds physically plausible earth surface range (-60°C to 60°C)`,
        raw_value: String(rawTemp)
      });
    } else {
      temperature = Number(num.toFixed(2));
    }
  }

  // 4. Validate humidity (can be null/empty, but if present must be between 0 and 100%)
  let humidity = null;
  const rawHum = normalized.humidity;
  if (rawHum !== undefined && rawHum !== null && rawHum !== '') {
    const num = Number(rawHum);
    if (isNaN(num)) {
      errors.push({
        field_name: 'humidity',
        issue_description: 'Relative humidity must be a valid numeric decimal value',
        raw_value: String(rawHum)
      });
    } else if (num < 0 || num > 100) {
      errors.push({
        field_name: 'humidity',
        issue_description: `Relative humidity value ${num}% is out of bounds (must be between 0% and 100%)`,
        raw_value: String(rawHum)
      });
    } else {
      humidity = Number(num.toFixed(2));
    }
  }

  // 5. Validate rainfall (can be null/empty, but if present must be >= 0 and <= 1500mm)
  let rainfall = null;
  const rawRain = normalized.rainfall;
  if (rawRain !== undefined && rawRain !== null && rawRain !== '') {
    const num = Number(rawRain);
    if (isNaN(num)) {
      errors.push({
        field_name: 'rainfall',
        issue_description: 'Rainfall must be a valid numeric decimal value',
        raw_value: String(rawRain)
      });
    } else if (num < 0) {
      errors.push({
        field_name: 'rainfall',
        issue_description: `Rainfall amount cannot be negative (${num} mm)`,
        raw_value: String(rawRain)
      });
    } else if (num > 1500) {
      errors.push({
        field_name: 'rainfall',
        issue_description: `Rainfall amount ${num} mm exceeds maximum single-day physical threshold (1500 mm)`,
        raw_value: String(rawRain)
      });
    } else {
      rainfall = Number(num.toFixed(2));
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors: errors.map(err => ({ ...err, source_row_number: rowNumber })),
      cleanedRecord: null
    };
  }

  return {
    isValid: true,
    errors: [],
    cleanedRecord: {
      observation_date: observationDate,
      location,
      temperature,
      humidity,
      rainfall
    }
  };
}

/**
 * Processes an uploaded CSV file from filePath
 */
async function processCsvUpload(filePath, originalFilename) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Create initial batch record
    const [batchResult] = await connection.query(
      `INSERT INTO import_batches (filename, total_rows, accepted_rows, rejected_rows, imported_at)
       VALUES (?, 0, 0, 0, NOW())`,
      [originalFilename]
    );
    const batchId = batchResult.insertId;

    // 2. Parse CSV
    const rows = [];
    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
    );

    let rowCounter = 1; // Row 1 is the header
    for await (const record of parser) {
      rowCounter++;
      rows.push({
        rowNumber: rowCounter,
        record
      });
    }

    const totalRows = rows.length;
    const acceptedRecords = [];
    const qualityIssues = [];

    // 3. Validate each row
    for (const item of rows) {
      const validation = validateRow(item.record, item.rowNumber);
      if (validation.isValid) {
        acceptedRecords.push(validation.cleanedRecord);
      } else {
        for (const err of validation.errors) {
          qualityIssues.push([
            batchId,
            err.source_row_number,
            err.field_name,
            err.issue_description.substring(0, 500),
            err.raw_value ? String(err.raw_value).substring(0, 255) : null
          ]);
        }
      }
    }

    // 4. Insert accepted weather_records in chunks
    if (acceptedRecords.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < acceptedRecords.length; i += chunkSize) {
        const chunk = acceptedRecords.slice(i, i + chunkSize);
        const values = chunk.map(r => [
          r.observation_date,
          r.location,
          r.temperature,
          r.humidity,
          r.rainfall
        ]);
        await connection.query(
          `INSERT INTO weather_records (observation_date, location, temperature, humidity, rainfall, created_at)
           VALUES ?`,
          [values.map(v => [...v, new Date()])]
        );
      }
    }

    // 5. Insert data_quality_issues in chunks
    if (qualityIssues.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < qualityIssues.length; i += chunkSize) {
        const chunk = qualityIssues.slice(i, i + chunkSize);
        await connection.query(
          `INSERT INTO data_quality_issues (batch_id, source_row_number, field_name, issue_description, raw_value, resolved, created_at)
           VALUES ?`,
          [chunk.map(c => [...c, 0, new Date()])]
        );
      }
    }

    // 6. Calculate counts
    const acceptedCount = acceptedRecords.length;
    const rejectedCount = totalRows - acceptedCount;

    // 7. Update batch record
    await connection.query(
      `UPDATE import_batches 
       SET total_rows = ?, accepted_rows = ?, rejected_rows = ?
       WHERE batch_id = ?`,
      [totalRows, acceptedCount, rejectedCount, batchId]
    );

    await connection.commit();

    return {
      batchId,
      filename: originalFilename,
      totalRows,
      acceptedRows: acceptedCount,
      rejectedRows: rejectedCount,
      qualityIssuesCount: qualityIssues.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    // Clean up temporary uploaded file if inside uploads directory
    try {
      if (filePath.includes('uploads') && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error('Failed to remove temp upload file:', e.message);
    }
  }
}

/**
 * Fetch all import batches with optional pagination
 */
async function getImportBatches(limit = 50, offset = 0) {
  const [rows] = await pool.query(
    `SELECT batch_id, filename, total_rows, accepted_rows, rejected_rows, imported_at
     FROM import_batches
     ORDER BY batch_id DESC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM import_batches');

  return {
    batches: rows,
    total: countRows[0].total
  };
}

/**
 * Fetch data quality issues for a given batch
 */
async function getBatchQualityIssues(batchId, limit = 100, offset = 0) {
  const [rows] = await pool.query(
    `SELECT issue_id, batch_id, source_row_number, field_name, issue_description, raw_value, resolved, created_at
     FROM data_quality_issues
     WHERE batch_id = ?
     ORDER BY source_row_number ASC, issue_id ASC
     LIMIT ? OFFSET ?`,
    [Number(batchId), Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM data_quality_issues WHERE batch_id = ?`,
    [Number(batchId)]
  );

  return {
    issues: rows,
    total: countRows[0].total
  };
}

module.exports = {
  processCsvUpload,
  getImportBatches,
  getBatchQualityIssues
};
