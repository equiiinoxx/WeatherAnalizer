const fs = require('fs');
const { parse } = require('csv-parse');
const pool = require('../config/db');

// Required column names in the CSV file
const REQUIRED_COLUMNS = ['observation_date', 'location', 'temperature', 'humidity', 'rainfall'];

// Documented plausible terrestrial limits
const PLAUSIBLE_TEMP_MIN = -60.0; // °C
const PLAUSIBLE_TEMP_MAX = 60.0;  // °C
const HUMIDITY_MIN = 0.0;        // %
const HUMIDITY_MAX = 100.0;      // %
const RAINFALL_MIN = 0.0;        // mm
const RAINFALL_MAX = 1500.0;     // mm (world record 24h rainfall is ~1825mm)

/**
 * Check if a string representation represents a missing value
 */
function isMissingValue(val) {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return trimmed === '' || trimmed === 'na' || trimmed === 'n/a' || trimmed === 'null' || trimmed === 'nan' || trimmed === '-';
  }
  return false;
}

/**
 * Process and validate CSV file upload within a database transaction
 */
async function processCsvUpload(filePath, originalFilename) {
  let parser;
  let rawHeaders = [];
  const rows = [];

  // 1. Read and parse the CSV stream
  try {
    const fileStream = fs.createReadStream(filePath);
    parser = fileStream.pipe(
      parse({
        columns: (header) => {
          rawHeaders = header.map(h => (typeof h === 'string' ? h.trim() : h));
          return rawHeaders;
        },
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      })
    );

    let currentLine = 1; // Row 1 is header
    for await (const record of parser) {
      currentLine++;
      rows.push({
        sourceRowNumber: currentLine,
        record
      });
    }
  } catch (parseErr) {
    throw new Error(`CSV Parsing Failure: ${parseErr.message}`);
  }

  // 2. Validate required CSV columns exist in header
  const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));
  const missingCols = [];

  for (const reqCol of REQUIRED_COLUMNS) {
    const normalizedReq = reqCol.replace(/[\s_-]+/g, '');
    const found = normalizedHeaders.some(h => h === normalizedReq);
    if (!found) {
      missingCols.push(reqCol);
    }
  }

  if (missingCols.length > 0) {
    throw new Error(
      `CSV validation failed: Missing required column(s): [${missingCols.join(', ')}]. ` +
      `Required headers are: [${REQUIRED_COLUMNS.join(', ')}]. Found in file: [${rawHeaders.join(', ')}]`
    );
  }

  // Map header keys to standardized property names
  function getField(record, targetCol) {
    const targetNorm = targetCol.replace(/[\s_-]+/g, '');
    for (const [key, val] of Object.entries(record)) {
      if (key.toLowerCase().trim().replace(/[\s_-]+/g, '') === targetNorm) {
        return val;
      }
    }
    return undefined;
  }

  const totalRows = rows.length;
  if (totalRows === 0) {
    throw new Error('The uploaded CSV file contains no data rows.');
  }

  // 3. Begin database transaction
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Insert initial import_batch record
    const [batchResult] = await connection.query(
      `INSERT INTO import_batches (filename, total_rows, accepted_rows, rejected_rows, imported_at)
       VALUES (?, ?, 0, 0, NOW())`,
      [originalFilename, totalRows]
    );
    const batchId = batchResult.insertId;

    // Track seen (date, location) pairs within this file to prevent duplicates
    const seenBatchKeys = new Map(); // key -> firstSeenRowNumber

    // Also fetch existing dates from database for locations present in the CSV to prevent duplicates
    const distinctDates = [...new Set(rows.map(r => getField(r.record, 'observation_date')).filter(Boolean))];
    const existingDbKeys = new Set();

    if (distinctDates.length > 0) {
      // Chunk check in DB if large date list
      const chunkSize = 500;
      for (let i = 0; i < distinctDates.length; i += chunkSize) {
        const dateChunk = distinctDates.slice(i, i + chunkSize);
        const [existingRows] = await connection.query(
          `SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') AS obs_date, location 
           FROM weather_records 
           WHERE observation_date IN (?)`,
          [dateChunk]
        );
        for (const er of existingRows) {
          existingDbKeys.add(`${er.obs_date}:::${er.location.toLowerCase()}`);
        }
      }
    }

    const acceptedRecords = [];
    const qualityIssues = []; // [batch_id, source_row_number, field_name, issue_description, raw_value]

    // Counters for fine-grained report
    let duplicateCount = 0;
    let missingRequiredCount = 0;
    let invalidCount = 0;
    let missingMeasurementsCount = 0;

    // 4. Validate each data row
    for (const item of rows) {
      const rowNum = item.sourceRowNumber;
      const rec = item.record;

      const rawDate = getField(rec, 'observation_date');
      const rawLoc = getField(rec, 'location');
      const rawTemp = getField(rec, 'temperature');
      const rawHum = getField(rec, 'humidity');
      const rawRain = getField(rec, 'rainfall');

      let rowHasFatalError = false;
      const rowIssues = [];

      // A. Validate observation_date
      let cleanDate = null;
      if (isMissingValue(rawDate)) {
        rowHasFatalError = true;
        missingRequiredCount++;
        rowIssues.push({
          field: 'observation_date',
          desc: 'Missing required observation_date',
          val: String(rawDate ?? '')
        });
      } else {
        const parsedDate = new Date(rawDate);
        if (isNaN(parsedDate.getTime())) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'observation_date',
            desc: 'Invalid date format: must be valid ISO or YYYY-MM-DD date',
            val: String(rawDate)
          });
        } else {
          // Check for future date (strictly historical observations)
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          if (parsedDate > today) {
            rowHasFatalError = true;
            invalidCount++;
            rowIssues.push({
              field: 'observation_date',
              desc: 'Observation date cannot be in the future (strictly historical analysis)',
              val: String(rawDate)
            });
          } else {
            cleanDate = parsedDate.toISOString().split('T')[0];
          }
        }
      }

      // B. Validate location
      let cleanLocation = null;
      if (isMissingValue(rawLoc)) {
        rowHasFatalError = true;
        missingRequiredCount++;
        rowIssues.push({
          field: 'location',
          desc: 'Missing required location identifier',
          val: String(rawLoc ?? '')
        });
      } else {
        cleanLocation = String(rawLoc).trim();
        if (cleanLocation.length > 100) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'location',
            desc: 'Location exceeds maximum permitted length of 100 characters',
            val: cleanLocation
          });
        }
      }

      // C. Duplicate Date/Location Check
      if (cleanDate && cleanLocation) {
        const compositeKey = `${cleanDate}:::${cleanLocation.toLowerCase()}`;
        if (seenBatchKeys.has(compositeKey)) {
          const priorRow = seenBatchKeys.get(compositeKey);
          rowHasFatalError = true;
          duplicateCount++;
          rowIssues.push({
            field: 'observation_date,location',
            desc: `Duplicate record in batch: identical date '${cleanDate}' and location '${cleanLocation}' already defined in row ${priorRow}`,
            val: `${cleanDate} | ${cleanLocation}`
          });
        } else if (existingDbKeys.has(compositeKey)) {
          rowHasFatalError = true;
          duplicateCount++;
          rowIssues.push({
            field: 'observation_date,location',
            desc: `Duplicate record: observation for location '${cleanLocation}' on date '${cleanDate}' already exists in database`,
            val: `${cleanDate} | ${cleanLocation}`
          });
        } else {
          seenBatchKeys.set(compositeKey, rowNum);
        }
      }

      // D. Validate Temperature (Plausible bounds: -60°C to +60°C)
      let cleanTemp = null;
      if (isMissingValue(rawTemp)) {
        // Preserved as NULL, NEVER silently converted to zero
        cleanTemp = null;
        missingMeasurementsCount++;
      } else {
        const tempNum = Number(rawTemp);
        if (isNaN(tempNum)) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'temperature',
            desc: 'Invalid temperature: value is not a valid numeric decimal',
            val: String(rawTemp)
          });
        } else if (tempNum < PLAUSIBLE_TEMP_MIN || tempNum > PLAUSIBLE_TEMP_MAX) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'temperature',
            desc: `Plausible bounds violation: Temperature ${tempNum}°C exceeds physical terrestrial bounds (${PLAUSIBLE_TEMP_MIN}°C to ${PLAUSIBLE_TEMP_MAX}°C)`,
            val: String(rawTemp)
          });
        } else {
          cleanTemp = Number(tempNum.toFixed(2));
        }
      }

      // E. Validate Humidity (Bounds: 0% to 100%)
      let cleanHum = null;
      if (isMissingValue(rawHum)) {
        // Preserved as NULL, NEVER silently converted to zero
        cleanHum = null;
        missingMeasurementsCount++;
      } else {
        const humNum = Number(rawHum);
        if (isNaN(humNum)) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'humidity',
            desc: 'Invalid humidity: value is not a valid numeric decimal',
            val: String(rawHum)
          });
        } else if (humNum < HUMIDITY_MIN || humNum > HUMIDITY_MAX) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'humidity',
            desc: `Bounds violation: Relative humidity ${humNum}% must be between ${HUMIDITY_MIN}% and ${HUMIDITY_MAX}%`,
            val: String(rawHum)
          });
        } else {
          cleanHum = Number(humNum.toFixed(2));
        }
      }

      // F. Validate Rainfall (Non-negative: >= 0mm, <= 1500mm)
      let cleanRain = null;
      if (isMissingValue(rawRain)) {
        // Preserved as NULL, NEVER silently converted to zero
        cleanRain = null;
        missingMeasurementsCount++;
      } else {
        const rainNum = Number(rawRain);
        if (isNaN(rainNum)) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'rainfall',
            desc: 'Invalid rainfall: value is not a valid numeric decimal',
            val: String(rawRain)
          });
        } else if (rainNum < RAINFALL_MIN) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'rainfall',
            desc: `Bounds violation: Rainfall cannot be negative (${rainNum} mm)`,
            val: String(rawRain)
          });
        } else if (rainNum > RAINFALL_MAX) {
          rowHasFatalError = true;
          invalidCount++;
          rowIssues.push({
            field: 'rainfall',
            desc: `Bounds violation: Single-day rainfall ${rainNum} mm exceeds upper physical limit (${RAINFALL_MAX} mm)`,
            val: String(rawRain)
          });
        } else {
          cleanRain = Number(rainNum.toFixed(2));
        }
      }

      // G. Check if row is completely missing all three measurements
      if (!rowHasFatalError && cleanTemp === null && cleanHum === null && cleanRain === null) {
        rowHasFatalError = true;
        missingRequiredCount++;
        rowIssues.push({
          field: 'measurements',
          desc: 'All three climate measurements (temperature, humidity, rainfall) are missing; row rejected',
          val: 'NULL'
        });
      }

      // Collect issues
      for (const iss of rowIssues) {
        qualityIssues.push([
          batchId,
          rowNum,
          iss.field,
          iss.desc.substring(0, 500),
          iss.val ? String(iss.val).substring(0, 255) : null
        ]);
      }

      // If no fatal error, accept the record
      if (!rowHasFatalError) {
        acceptedRecords.push([
          cleanDate,
          cleanLocation,
          cleanTemp,  // Note: NULL is passed directly, NEVER 0
          cleanHum,   // Note: NULL is passed directly, NEVER 0
          cleanRain,  // Note: NULL is passed directly, NEVER 0
          new Date()
        ]);
      }
    }

    // 5. Insert accepted weather_records in parameterized batch chunks
    if (acceptedRecords.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < acceptedRecords.length; i += chunkSize) {
        const chunk = acceptedRecords.slice(i, i + chunkSize);
        await connection.query(
          `INSERT INTO weather_records 
           (observation_date, location, temperature, humidity, rainfall, created_at)
           VALUES ?`,
          [chunk]
        );
      }
    }

    // 6. Insert data_quality_issues in parameterized batch chunks
    if (qualityIssues.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < qualityIssues.length; i += chunkSize) {
        const chunk = qualityIssues.slice(i, i + chunkSize);
        await connection.query(
          `INSERT INTO data_quality_issues 
           (batch_id, source_row_number, field_name, issue_description, raw_value, resolved, created_at)
           VALUES ?`,
          [chunk.map(c => [...c, 0, new Date()])]
        );
      }
    }

    // 7. Update import_batches totals
    const acceptedCount = acceptedRecords.length;
    const rejectedCount = totalRows - acceptedCount;

    await connection.query(
      `UPDATE import_batches 
       SET accepted_rows = ?, rejected_rows = ?
       WHERE batch_id = ?`,
      [acceptedCount, rejectedCount, batchId]
    );

    // Commit database transaction
    await connection.commit();

    return {
      batchId,
      filename: originalFilename,
      totalRows,
      acceptedRows: acceptedCount,
      rejectedRows: rejectedCount,
      qualityIssuesLogged: qualityIssues.length,
      breakdown: {
        accepted: acceptedCount,
        rejected: rejectedCount,
        duplicatesDetected: duplicateCount,
        missingRequiredFields: missingRequiredCount,
        invalidOrOutOfBounds: invalidCount,
        missingMeasurementsPreservedAsNull: missingMeasurementsCount
      },
      duplicatePolicy: 'Duplicate (date, location) records were rejected to preserve database uniqueness and logged to data_quality_issues.',
      nullHandlingPolicy: 'Missing measurements were strictly preserved as NULL in database; never converted to zero.'
    };
  } catch (error) {
    // Rollback ensures failed imports do not leave partially committed records
    await connection.rollback();
    throw error;
  } finally {
    connection.release();

    // Clean up temporary file
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupErr) {
      console.error('Failed to unlink uploaded temp file:', cleanupErr.message);
    }
  }
}

/**
 * Get import batches list with pagination
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
    pagination: {
      total: countRows[0].total,
      limit: Number(limit),
      offset: Number(offset)
    }
  };
}

/**
 * Get details for a single batch
 */
async function getBatchById(batchId) {
  const [rows] = await pool.query(
    `SELECT batch_id, filename, total_rows, accepted_rows, rejected_rows, imported_at
     FROM import_batches
     WHERE batch_id = ?`,
    [Number(batchId)]
  );

  if (rows.length === 0) return null;

  const [issuesCount] = await pool.query(
    'SELECT COUNT(*) as count FROM data_quality_issues WHERE batch_id = ?',
    [Number(batchId)]
  );

  return {
    ...rows[0],
    quality_issues_count: issuesCount[0].count
  };
}

/**
 * Get data quality issues for a given batch
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
    batchId: Number(batchId),
    issues: rows,
    pagination: {
      total: countRows[0].total,
      limit: Number(limit),
      offset: Number(offset)
    }
  };
}

/**
 * Get global data quality issues across all batches
 */
async function getAllQualityIssues(limit = 100, offset = 0, batchId = null) {
  let whereSql = '';
  const params = [];

  if (batchId) {
    whereSql = 'WHERE d.batch_id = ?';
    params.push(Number(batchId));
  }

  const query = `
    SELECT d.issue_id, d.batch_id, b.filename, d.source_row_number, 
           d.field_name, d.issue_description, d.raw_value, d.resolved, d.created_at
    FROM data_quality_issues d
    JOIN import_batches b ON d.batch_id = b.batch_id
    ${whereSql}
    ORDER BY d.issue_id DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `SELECT COUNT(*) AS total FROM data_quality_issues d ${whereSql}`;

  const [rows] = await pool.query(query, [...params, Number(limit), Number(offset)]);
  const [countResult] = await pool.query(countSql, params);

  return {
    issues: rows,
    pagination: {
      total: countResult[0].total,
      limit: Number(limit),
      offset: Number(offset)
    }
  };
}

module.exports = {
  processCsvUpload,
  getImportBatches,
  getBatchById,
  getBatchQualityIssues,
  getAllQualityIssues,
  REQUIRED_COLUMNS
};
