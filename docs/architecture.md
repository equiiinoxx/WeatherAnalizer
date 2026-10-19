# Weather Data Analysis System — Architecture & Documentation

## 1. Project Overview
The **Weather Data Analysis System** is an enterprise-grade academic platform designed strictly for storing, validating, aggregating, and statistically analyzing **historical weather observations**. In compliance with design specifications, predictive modeling and weather forecasting are strictly excluded.

---

## 2. Technology Stack
- **Frontend**: React 19, Vite 8, Recharts 3.10.1, Axios, plain CSS.
- **Backend**: Node.js, Express 5.3, MySQL2 (promise-based connection pool), Multer, csv-parse, dotenv.
- **Database**: MySQL 8.0 Community Server (`weather_analysis`).
- **Data Science / Analytics**: Python 3.15, Pandas, NumPy, Matplotlib, mysql-connector-python (`.venv`).
- **Ports**: Backend on `http://localhost:5000`, Frontend on `http://localhost:5173`.

---

## 3. Database Schema

The system uses three core tables in MySQL:

### 1. `import_batches`
Tracks every CSV upload attempt and its validation statistics:
- `batch_id` (BIGINT UNSIGNED, Primary Key, Auto Increment)
- `filename` (VARCHAR(255), Not Null)
- `total_rows` (INT UNSIGNED, Default 0)
- `accepted_rows` (INT UNSIGNED, Default 0)
- `rejected_rows` (INT UNSIGNED, Default 0)
- `imported_at` (TIMESTAMP, Default CURRENT_TIMESTAMP)

### 2. `weather_records`
Stores cleaned, verified historical observations:
- `record_id` (BIGINT UNSIGNED, Primary Key, Auto Increment)
- `observation_date` (DATE, Not Null)
- `location` (VARCHAR(100), Not Null)
- `temperature` (DECIMAL(5,2), Nullable)
- `humidity` (DECIMAL(5,2), Nullable)
- `rainfall` (DECIMAL(7,2), Nullable)
- `created_at` (TIMESTAMP, Default CURRENT_TIMESTAMP)
- **Index**: `idx_date_location (observation_date, location)`

### 3. `data_quality_issues`
Stores rejected rows with precise audit metadata for data governance:
- `issue_id` (BIGINT UNSIGNED, Primary Key, Auto Increment)
- `batch_id` (BIGINT UNSIGNED, Foreign Key to `import_batches(batch_id)` ON DELETE CASCADE)
- `source_row_number` (INT UNSIGNED, Not Null — indicates source CSV line)
- `field_name` (VARCHAR(100), Not Null)
- `issue_description` (VARCHAR(500), Not Null)
- `raw_value` (VARCHAR(255), Nullable)
- `resolved` (TINYINT(1), Default 0)
- `created_at` (TIMESTAMP, Default CURRENT_TIMESTAMP)

---

## 4. Ingestion Pipeline & Quality Assurance Rules
The ingestion engine (`backend/services/importService.js`) processes uploaded CSV files in transactions:
1. **Date Validation**: Must be parseable standard date format. Future dates are rejected (historical data only).
2. **Location Validation**: Non-empty string, maximum 100 characters.
3. **Temperature Bounds**: Terrestrial plausible range: `-60°C` to `+60°C`. Out-of-bounds values rejected.
4. **Humidity Bounds**: Relative humidity must be between `0%` and `100%`.
5. **Rainfall Bounds**: Non-negative decimal (`>= 0 mm`) up to single-day threshold (`1500 mm`).
6. **Traceability**: If any row fails one or more rules, the row is rejected from `weather_records` and logged to `data_quality_issues` with exact `source_row_number`.

---

## 5. API Endpoints

### System Health
- `GET /api/health` — Returns DB connection status and server timestamp.

### CSV Import
- `POST /api/import/upload` — Multi-part CSV file upload.
- `GET /api/import/batches` — List import history with pagination.
- `GET /api/import/batches/:batchId/issues` — Detailed quality issues for a batch.

### Weather Records & Trends
- `GET /api/weather/records` — Filtered observations (by location, date range, min/max temp, sort, pagination).
- `GET /api/weather/locations` — Unique monitoring locations list.
- `GET /api/weather/summary` — High-level KPIs, top extremes, regional summary.
- `GET /api/weather/trends` — Monthly aggregated means, min/max envelopes for Recharts.
- `GET /api/weather/export` — Stream filtered observations as CSV.

### Statistical Analysis
- `POST /api/analysis/run` — Triggers Python analytics engine (`analysis/analyze.py`).
- `GET /api/analysis/latest` — Fetches cached or latest statistical engine results.
- `GET /api/charts/:filename` — Serves generated Matplotlib figures.

---

## 6. How to Run

### Backend Development Server
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

### Frontend Development Server
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```
