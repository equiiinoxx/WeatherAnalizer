-- Migration: 001_add_unique_date_location.sql
-- Description: Add unique constraint on (observation_date, location) to prevent duplicate weather observation records.

-- Note: MySQL does not have "ADD CONSTRAINT IF NOT EXISTS" syntax,
-- so this statement should be run via the migration runner script or checked before executing.

ALTER TABLE `weather_records` 
  ADD UNIQUE KEY `uq_date_location` (`observation_date`, `location`);
