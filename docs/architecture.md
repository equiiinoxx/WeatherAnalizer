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
- **Constraints**: `UNIQUE KEY uq_date_location (observation_date, location)`
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
6. **Missing Measurement Preservation**: Missing observations for temperature, humidity, or rainfall are stored as `NULL` in MySQL and NEVER converted to zero.
7. **Traceability**: If any row fails one or more rules, the row is rejected from `weather_records` and logged to `data_quality_issues` with exact `source_row_number`.
8. **Duplicate Handling**: Duplicates are checked across the batch and against the database. Duplicates are rejected and recorded in `data_quality_issues` to protect the unique constraint on `(observation_date, location)`.

---

## 5. Python Analytics Engine (`analysis/`)

The Python statistical engine is structured into modular components:

### Modules
1. **`analysis/validate_data.py`**:
   - Validates CSV files or DataFrames before ingestion or analysis.
   - Detects missing required columns, missing values, invalid date formats, future dates, non-numeric measurements, out-of-range humidity (0–100%), negative rainfall, implausible temperatures (-60°C to +60°C), and duplicate records.
   - CLI: `python validate_data.py <path_to_csv>`
2. **`analysis/analyze_weather.py`**:
   - Calculates daily and monthly minimum, maximum, and average temperature, humidity, and rainfall.
   - Computes monthly rainfall totals and compares monthly average temperatures across monitoring locations.
   - Calculates parametric and non-parametric descriptive statistics (mean, std, min, 25%, median, 75%, max, IQR, skewness) using NumPy and Pandas.
   - Computes Pearson correlation matrix (temperature, humidity, rainfall).
   - Detects historical climate anomalies ($|Z| > 2.5\sigma$).
   - CLI: `python analyze_weather.py [--csv <path>] [--location <loc>] [--start-date <YYYY-MM-DD>] [--end-date <YYYY-MM-DD>]`
3. **`analysis/generate_charts.py`**:
   - Uses non-interactive Matplotlib backend (`Agg`) to generate publication-grade figures saved to `analysis/charts/`:
     - `temperature_trends.png`: Monthly min, avg, and max temperature variation envelopes with units (°C).
     - `monthly_rainfall.png`: Monthly cumulative precipitation bar charts with values in millimeters (mm).
     - `monthly_temperature_comparison.png`: Comparison of monthly average temperatures across monitoring locations.
     - `humidity_trends.png`: Relative humidity trends and variations over time (0–100%).
     - `temperature_distribution.png`: Histogram and KDE distribution with mean/median markers.
     - `humidity_rainfall_scatter.png`: Scatter plot with colormapped temperature variation.
   - CLI: `python generate_charts.py --csv <path>`
4. **`analysis/test_analysis.py`**:
   - Comprehensive automated test suite verifying validation rules, statistical aggregations, chart generation, and database integration.

### Safe Node.js Invocation on Windows
The Node.js controller ([`backend/controllers/analysisController.js`](file:///C:/Users/subha/Projects/WeatherAnalizer/backend/controllers/analysisController.js)) invokes Python using `child_process.spawn`:
- **Python Executable**: Resolved explicitly to `.venv\Scripts\python.exe` on Windows (or `.venv/bin/python` on POSIX).
- **Shell-Injection Immunity**: Options are passed via a structured array of arguments (`[scriptPath, '--location', loc, ...]`) with `shell: false`. No arguments are passed through `cmd.exe` or PowerShell command strings.
- **Clean Stream Separation**: Python writes diagnostics and warnings to `sys.stderr` and strictly valid JSON to `sys.stdout`, preventing JSON parsing corruption in Node.js.

---

## 6. How to Run and Test

### 1. Run Python Test Suite
```bash
.\.venv\Scripts\python.exe analysis\test_analysis.py
```

### 2. Run Backend Test Suite
```bash
cd backend
npm test
```

### 3. Run Safe Database Migrations
```bash
cd backend
npm run migrate
```

### 4. Start Development Servers
```bash
# Terminal 1: Backend API (port 5000)
cd backend
npm run dev

# Terminal 2: React Frontend (port 5173)
cd frontend
npm run dev
```
