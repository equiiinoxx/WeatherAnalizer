-- Weather Data Analysis System
-- Database Schema for MySQL 8.0
-- Database: weather_analysis

CREATE DATABASE IF NOT EXISTS `weather_analysis` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `weather_analysis`;

-- Table 1: import_batches
-- Tracks metadata and status for every uploaded CSV file
CREATE TABLE IF NOT EXISTS `import_batches` (
  `batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_rows` int unsigned DEFAULT '0',
  `accepted_rows` int unsigned DEFAULT '0',
  `rejected_rows` int unsigned DEFAULT '0',
  `imported_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: weather_records
-- Historical weather observations (no forecasting or predictions)
CREATE TABLE IF NOT EXISTS `weather_records` (
  `record_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `observation_date` date NOT NULL,
  `location` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `rainfall` decimal(7,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`record_id`),
  UNIQUE KEY `uq_date_location` (`observation_date`,`location`),
  KEY `idx_date_location` (`observation_date`,`location`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: data_quality_issues
-- Records anomalies and validation errors encountered during CSV import
CREATE TABLE IF NOT EXISTS `data_quality_issues` (
  `issue_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `source_row_number` int unsigned NOT NULL,
  `field_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `raw_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`issue_id`),
  KEY `fk_quality_batch` (`batch_id`),
  CONSTRAINT `fk_quality_batch` FOREIGN KEY (`batch_id`) REFERENCES `import_batches` (`batch_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
