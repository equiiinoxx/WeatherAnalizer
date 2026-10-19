# Weather Data Analysis System

An end-to-end meteorological data management and analytical dashboard engineered strictly for **historical weather observations**. Built with a modern full-stack architecture combining a **React + Vite** frontend, an **Express + Node.js** REST API with connection pooling and transactional CSV ingestion, a **MySQL 8.0** relational database with data quality audit tables, and a **Python (Pandas, NumPy, Matplotlib)** scientific computing engine.

> **Project Mandate**: In compliance with academic specifications, this platform is strictly scoped to historical observational analysis and data quality governance. Predictive modeling and weather forecasting are explicitly excluded.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │        React 19 + Vite Frontend         │
                      │       (Port 5173 - Plain CSS)           │
                      └────────────────────┬────────────────────┘
                                           │ HTTP / REST
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │         Express 5.3 REST API            │
                      │         (Port 5000 - Node.js)           │
                      └─────────────┬─────────────┬─────────────┘
                                    │             │
                Transactional SQL   │             │ Child Process (Safe CLI)
                                    ▼             ▼
  ┌───────────────────────────────────┐    ┌───────────────────────────────────┐
  │         MySQL 8.0 Database        │    │      Python Analysis Engine       │
  │      `weather_analysis`           │    │       (Pandas, NumPy, MPL)        │
  │  - weather_records                │    │  - validate_data.py               │
  │  - import_batches                 │    │  - analyze_weather.py             │
  │  - data_quality_issues            │    │  - generate_charts.py             │
  └───────────────────────────────────┘    └───────────────────────────────────┘
```

---

## Key Features

1. **Transactional Ingestion & Quality Audit**:
   - Ingests CSV observation files using Multer and streaming CSV parsing.
   - Enforces strict validation: date formats, chronological validity (no future dates), location strings, terrestrial temperature bounds ($-60^\circ\text{C}$ to $+60^\circ\text{C}$), relative humidity ($0\%$ to $100\%$), and non-negative rainfall ($\ge 0\text{ mm}$).
   - Rejects duplicate date/location combinations against both database records and within the same uploaded batch.
   - Preserves actual `NULL` values; missing measurements are never silently converted into zero.
   - Logs row-level issues into `data_quality_issues` with exact `source_row_number` and field names.

2. **Historical Data Analytics**:
   - Calculates daily and monthly aggregates: minimum, maximum, and average temperature, humidity, and rainfall.
   - Monthly rainfall totals and inter-station temperature comparisons.
   - Anomaly detection via Z-score evaluation ($|Z| > 2.5\sigma$) and Pearson correlation coefficients.

3. **Interactive & High-Performance UI**:
   - Clean, responsive dashboard built with plain CSS and modern CSS variables (dark theme).
   - Recharts-powered interactive visualizations for temperature trends, humidity trends, and monthly comparisons.
   - Location and date-range filters with pagination.
   - Real-time MySQL connection health monitor badge.
   - One-click CSV export for filtered records, summary statistics, and data quality issue audit logs.

4. **Publication-Grade Python Visualizations**:
   - Standalone Matplotlib pipeline generating high-resolution PNG charts in `analysis/charts/`.
   - Clear axes, standard units ($^\circ\text{C}$, $\%$, $\text{mm}$), legends, and timestamped summaries.

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v18.0.0` or higher (verified on Node `v22+` / `v24+`)
- **Python**: `v3.10` or higher (verified on Python `v3.15`)
- **MySQL Server**: `8.0+` Community Server
- **Git**

---

## Windows Setup & Installation

### 1. Clone or Open the Workspace
```powershell
cd C:\Users\<YourUser>\Projects\WeatherAnalizer
```

> **Windows PowerShell Note**: If executing `npm` triggers a `PSSecurityException` (`File npm.ps1 cannot be loaded because running scripts is disabled`), either run PowerShell as Administrator and execute `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`, or execute commands prefixed with `cmd /c` (e.g., `cmd /c npm run dev`).

---

### 2. Configure the MySQL Database

1. Ensure the MySQL 8.0 service is running:
   ```powershell
   Get-Service -Name MySQL*
   ```
2. Log into MySQL and create the database schema:
   ```powershell
   mysql -u root -p < database/schema.sql
   ```
3. Run the automated migration script to guarantee all schema constraints (such as `uq_date_location`) are active:
   ```powershell
   cd backend
   node scripts/migrate.js
   cd ..
   ```

---

### 3. Backend Environment Configuration (`backend/.env`)

Create or verify `backend/.env` with your local MySQL credentials:

```ini
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_root_password
DB_NAME=weather_analysis
CORS_ORIGIN=http://localhost:5173
PYTHON_PATH=C:/Users/subha/Projects/WeatherAnalizer/.venv/Scripts/python.exe
```

> **Security Mandate**: Never commit passwords or `.env` files to source control. The root `.gitignore` is pre-configured to exclude `.env` files.

---

### 4. Install Dependencies

#### A. Backend Dependencies
```powershell
cd backend
cmd /c npm install
cd ..
```

#### B. Frontend Dependencies
```powershell
cd frontend
cmd /c npm install
cd ..
```

#### C. Python Virtual Environment (`.venv`)
```powershell
# Create virtual environment if not already created
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\activate

# Install required analysis packages
pip install -r analysis/requirements.txt
```

---

## Running the Application

### Option A: Run Backend & Frontend in Two Terminal Windows

#### Terminal 1 — Start the Express API Backend:
```powershell
cd backend
cmd /c npm run dev
```
*Backend runs on `http://localhost:5000`.*

#### Terminal 2 — Start the React Vite Frontend:
```powershell
cd frontend
cmd /c npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## Running Automated Tests

### 1. Backend Integration Tests (37 Assertions)
Tests database connectivity, parameterized pagination, date filtering, location queries, daily/monthly summaries, CSV upload ingestion, duplicate prevention, and CSV exports.
```powershell
cd backend
node scripts/test-backend.js
```

### 2. Python Analytical Engine Tests (7 Unit Tests)
Tests CSV validation, out-of-bounds detection, missing measurement preservation, daily/monthly groupings, descriptive statistics, anomaly detection, and Matplotlib chart rendering.
```powershell
.\.venv\Scripts\python.exe analysis/test_analysis.py
```

### 3. Frontend Production Build Verification
Verifies that all React components, hooks, Recharts charts, and routes compile cleanly without warnings or errors.
```powershell
cd frontend
cmd /c npm run build
```

---

## API Endpoints Reference

All endpoints are hosted at `http://localhost:5000/api`.

| HTTP Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Real MySQL connection health check | None |
| `GET` | `/weather` | Paginated weather records with filtering | `page`, `limit`, `location`, `startDate`, `endDate`, `sortBy`, `sortOrder` |
| `GET` | `/weather/locations` | Distinct list of meteorological stations | None |
| `GET` | `/weather/summary/daily` | Daily aggregates (Min, Max, Avg, Rainfall) | `location`, `startDate`, `endDate`, `page`, `limit` |
| `GET` | `/weather/summary/monthly`| Monthly aggregates & rainfall totals | `location`, `year` |
| `GET` | `/weather/summary/stats` | High-level KPI metrics for dashboard | `location`, `startDate`, `endDate` |
| `GET` | `/weather/charts/data` | Pre-aggregated time-series data for Recharts | `location`, `startDate`, `endDate` |
| `POST` | `/weather/upload` | Multipart CSV upload and transactional ingest | `file` (multipart/form-data) |
| `GET` | `/weather/imports` | Paginated history of batch imports | `page`, `limit` |
| `GET` | `/weather/imports/:id/issues` | Row-level data quality issues for a batch | `page`, `limit` |
| `GET` | `/weather/export` | Download filtered records as CSV | `location`, `startDate`, `endDate` |
| `GET` | `/weather/export/summary` | Download daily aggregate summaries as CSV | `location`, `startDate`, `endDate` |
| `GET` | `/weather/export/issues/:batchId` | Download data quality issues as CSV | None |

---

## Python Analytical Engine

The system includes a Python engine under `analysis/` that executes against `.venv`:

- **`analysis/validate_data.py`**:
  Validates CSV files against strict schemas. Detects invalid dates, implausible temperatures ($-60^\circ\text{C}$ to $+60^\circ\text{C}$), invalid humidity ($0$–$100\%$), negative rainfall, duplicates, and missing values. Outputs JSON to `stdout` and diagnostic logs to `stderr`.
- **`analysis/analyze_weather.py`**:
  Calculates daily/monthly statistics, Pearson correlation between temperature and humidity, and detects statistical anomalies ($|Z| > 2.5$).
- **`analysis/generate_charts.py`**:
  Generates six publication-grade Matplotlib charts into `analysis/charts/`:
  1. `temperature_trends.png`
  2. `monthly_rainfall.png`
  3. `monthly_temperature_comparison.png`
  4. `humidity_trends.png`
  5. `temperature_distribution.png`
  6. `humidity_rainfall_scatter.png`

---

## Sample Data

Sample datasets are located in `sample_data/`:
- `weather_data.csv`: A clean, illustrative sample dataset covering 5 stations across January 2023.
- `weather_data_invalid.csv`: An illustrative test dataset containing intentional anomalies (negative rain, out-of-range temperature, unparseable dates, duplicates) to test the validation pipeline.

---

## Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `PSSecurityException` on running `npm` | Windows PowerShell script execution policy restricts `.ps1` files. | Run commands via `cmd /c npm ...` or run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` in an admin PowerShell window. |
| `ER_ACCESS_DENIED_ERROR` | Incorrect MySQL credentials in `backend/.env`. | Verify `DB_USER` and `DB_PASSWORD` in `backend/.env`. Test login using `mysql -u root -p`. |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL server service is stopped. | Start MySQL in Windows Services (`services.msc`) or run `Start-Service MySQL80` in PowerShell. |
| Python script not found | `PYTHON_PATH` is incorrect in `backend/.env`. | Set `PYTHON_PATH` to the absolute path of `.venv/Scripts/python.exe` using forward slashes (e.g. `C:/Users/.../.venv/Scripts/python.exe`). |
| Port 5000 or 5173 already in use | Another application is bound to the port. | Change `PORT` in `backend/.env` or kill the conflicting PID using `netstat -ano \| findstr :5000` and `taskkill /PID <PID> /F`. |

---

## Academic License & Integrity

This project is developed for academic evaluation in the College Degree curriculum. All algorithms, database queries, and architectural components have been custom developed without third-party template bloat or predictive forecasting assumptions.
