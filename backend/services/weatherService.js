const pool = require('../config/db');

/**
 * Build dynamic WHERE clause based on query filters
 */
function buildFilterClause(filters) {
  const conditions = [];
  const params = [];

  if (filters.location && filters.location.trim() !== '' && filters.location !== 'ALL') {
    conditions.push('location = ?');
    params.push(filters.location.trim());
  }

  if (filters.startDate) {
    conditions.push('observation_date >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('observation_date <= ?');
    params.push(filters.endDate);
  }

  if (filters.minTemp !== undefined && filters.minTemp !== null && filters.minTemp !== '') {
    conditions.push('temperature >= ?');
    params.push(Number(filters.minTemp));
  }

  if (filters.maxTemp !== undefined && filters.maxTemp !== null && filters.maxTemp !== '') {
    conditions.push('temperature <= ?');
    params.push(Number(filters.maxTemp));
  }

  if (filters.search && filters.search.trim() !== '') {
    conditions.push('location LIKE ?');
    params.push(`%${filters.search.trim()}%`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}

/**
 * Fetch paginated weather records with filters
 */
async function getRecords(filters = {}) {
  const page = Math.max(1, parseInt(filters.page || 1, 10));
  const limit = Math.min(200, Math.max(1, parseInt(filters.limit || 20, 10)));
  const offset = (page - 1) * limit;

  const allowedSortColumns = ['record_id', 'observation_date', 'location', 'temperature', 'humidity', 'rainfall'];
  const sortBy = allowedSortColumns.includes(filters.sortBy) ? filters.sortBy : 'observation_date';
  const sortOrder = String(filters.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { whereSql, params } = buildFilterClause(filters);

  const querySql = `
    SELECT record_id, DATE_FORMAT(observation_date, '%Y-%m-%d') AS observation_date, 
           location, temperature, humidity, rainfall, created_at
    FROM weather_records
    ${whereSql}
    ORDER BY ${sortBy} ${sortOrder}, record_id ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  const countSql = `SELECT COUNT(*) AS total FROM weather_records ${whereSql}`;

  const [records] = await pool.query(querySql, [...params, limit, offset]);
  const [countResult] = await pool.query(countSql, params);

  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limit);

  return {
    records,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Get distinct locations
 */
async function getLocations() {
  const [rows] = await pool.query(
    'SELECT DISTINCT location FROM weather_records ORDER BY location ASC'
  );
  return rows.map(r => r.location);
}

/**
 * Get comprehensive summary statistics and KPIs
 */
async function getSummaryMetrics(filters = {}) {
  const { whereSql, params } = buildFilterClause(filters);

  const statsSql = `
    SELECT 
      COUNT(*) AS total_records,
      COUNT(DISTINCT location) AS unique_locations,
      DATE_FORMAT(MIN(observation_date), '%Y-%m-%d') AS first_date,
      DATE_FORMAT(MAX(observation_date), '%Y-%m-%d') AS last_date,
      ROUND(AVG(temperature), 2) AS avg_temperature,
      MIN(temperature) AS min_temperature,
      MAX(temperature) AS max_temperature,
      ROUND(AVG(humidity), 2) AS avg_humidity,
      MIN(humidity) AS min_humidity,
      MAX(humidity) AS max_humidity,
      ROUND(SUM(rainfall), 2) AS total_rainfall,
      ROUND(AVG(rainfall), 2) AS avg_rainfall,
      MAX(rainfall) AS max_rainfall
    FROM weather_records
    ${whereSql}
  `;

  const [statsRows] = await pool.query(statsSql, params);
  const stats = statsRows[0];

  // Top hottest historical records
  const [hottest] = await pool.query(
    `SELECT record_id, DATE_FORMAT(observation_date, '%Y-%m-%d') AS observation_date, location, temperature
     FROM weather_records
     ${whereSql}
     ORDER BY temperature DESC
     LIMIT 5`,
    params
  );

  // Top wettest days
  const [wettest] = await pool.query(
    `SELECT record_id, DATE_FORMAT(observation_date, '%Y-%m-%d') AS observation_date, location, rainfall
     FROM weather_records
     ${whereSql}
     ORDER BY rainfall DESC
     LIMIT 5`,
    params
  );

  // Per-location breakdown
  const [locationBreakdown] = await pool.query(
    `SELECT 
       location,
       COUNT(*) AS record_count,
       ROUND(AVG(temperature), 2) AS avg_temp,
       ROUND(AVG(humidity), 2) AS avg_humidity,
       ROUND(SUM(rainfall), 2) AS total_rain
     FROM weather_records
     ${whereSql}
     GROUP BY location
     ORDER BY avg_temp DESC`,
    params
  );

  return {
    kpis: {
      totalRecords: stats.total_records || 0,
      uniqueLocations: stats.unique_locations || 0,
      dateRange: {
        from: stats.first_date,
        to: stats.last_date
      },
      temperature: {
        avg: stats.avg_temperature,
        min: stats.min_temperature,
        max: stats.max_temperature
      },
      humidity: {
        avg: stats.avg_humidity,
        min: stats.min_humidity,
        max: stats.max_humidity
      },
      rainfall: {
        total: stats.total_rainfall,
        avg: stats.avg_rainfall,
        max: stats.max_rainfall
      }
    },
    extremes: {
      hottest,
      wettest
    },
    locationBreakdown
  };
}

/**
 * Aggregated monthly/time trends for chart visualizations
 */
async function getTrends(filters = {}) {
  const { whereSql, params } = buildFilterClause(filters);

  // Group by month
  const monthlySql = `
    SELECT 
      DATE_FORMAT(observation_date, '%Y-%m') AS month,
      ROUND(AVG(temperature), 2) AS avg_temperature,
      ROUND(MIN(temperature), 2) AS min_temperature,
      ROUND(MAX(temperature), 2) AS max_temperature,
      ROUND(AVG(humidity), 2) AS avg_humidity,
      ROUND(SUM(rainfall), 2) AS total_rainfall,
      ROUND(AVG(rainfall), 2) AS avg_rainfall,
      COUNT(*) AS record_count
    FROM weather_records
    ${whereSql}
    GROUP BY DATE_FORMAT(observation_date, '%Y-%m')
    ORDER BY month ASC
  `;

  const [monthlyTrends] = await pool.query(monthlySql, params);

  return {
    monthlyTrends
  };
}

/**
 * Export filtered records to CSV text
 */
async function exportRecordsCsv(filters = {}) {
  const { whereSql, params } = buildFilterClause(filters);

  const [records] = await pool.query(
    `SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') AS observation_date, 
            location, temperature, humidity, rainfall
     FROM weather_records
     ${whereSql}
     ORDER BY observation_date ASC, location ASC`,
    params
  );

  const header = ['observation_date', 'location', 'temperature', 'humidity', 'rainfall'];
  const lines = [header.join(',')];

  for (const r of records) {
    const row = [
      r.observation_date,
      `"${String(r.location).replace(/"/g, '""')}"`,
      r.temperature !== null ? r.temperature : '',
      r.humidity !== null ? r.humidity : '',
      r.rainfall !== null ? r.rainfall : ''
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

module.exports = {
  getRecords,
  getLocations,
  getSummaryMetrics,
  getTrends,
  exportRecordsCsv
};
