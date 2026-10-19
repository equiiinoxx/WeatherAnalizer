const pool = require('../config/db');

async function runMigrations() {
  console.log('--- Starting Safe Database Migrations ---');
  const connection = await pool.getConnection();

  try {
    // 1. Check existing indexes on weather_records
    const [indexes] = await connection.query('SHOW INDEX FROM weather_records');
    const hasUniqueConstraint = indexes.some(
      (idx) => idx.Key_name === 'uq_date_location' && idx.Non_unique === 0
    );

    if (!hasUniqueConstraint) {
      console.log('Adding UNIQUE KEY uq_date_location (observation_date, location) to weather_records...');
      await connection.query(
        'ALTER TABLE weather_records ADD UNIQUE KEY uq_date_location (observation_date, location)'
      );
      console.log('✓ Successfully added unique constraint on (observation_date, location).');
    } else {
      console.log('✓ Unique constraint uq_date_location already present on weather_records.');
    }

    console.log('--- Migrations Completed Successfully ---');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
