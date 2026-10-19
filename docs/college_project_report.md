# College Project Submission Report

---

**Project Title:** Weather Data Analysis System  
**Discipline:** Computer Science and Engineering  
**Application Type:** Full-Stack Meteorological Data Analytics & Governance Platform  
**Target Environment:** Node.js, React, MySQL 8.0, Python (Pandas/NumPy/Matplotlib), Windows 11  

---

## Executive Summary

The **Weather Data Analysis System** is an enterprise-grade full-stack software application engineered for the ingestion, validation, persistence, statistical aggregation, and interactive visualization of historical weather observations. 

Modern meteorological management demands strict data integrity: raw sensor observations often contain missing values, human input errors, sensor drift, and duplicate entries. A common flaw in legacy analytical platforms is silently coercing missing sensor readings into zeros (e.g., recording missing precipitation or temperature as $0$), which heavily distorts statistical baselines. Furthermore, many commercial projects blur the boundary between verified historical observations and probabilistic predictive models.

This system addresses both challenges:
1. It is **strictly scoped to historical meteorological observations**, guaranteeing that no forecasting, machine learning extrapolation, or speculative predictions are performed.
2. It implements a **rigorous multi-stage data validation and audit pipeline**, rejecting unphysical measurements (e.g., temperatures outside $-60^\circ\text{C}$ to $+60^\circ\text{C}$, relative humidity outside $0\%$–$100\%$, negative rainfall, and unparseable dates), enforcing database transaction atomicity, preserving authentic `NULL` states, and logging line-by-line validation errors into a dedicated governance table (`data_quality_issues`).

---

## 1. Project Objective

The primary objectives of this project are:
- **Data Governance & Integrity:** Build a resilient ingestion engine that validates historical weather observations from CSV uploads, rejecting erroneous or corrupt records while providing fine-grained audit feedback (source row number, target column, exact error reason).
- **Relational Data Persistence:** Model and implement a normalized MySQL 8.0 schema with connection pooling, transactional atomicity, unique constraint enforcement on `(observation_date, location)`, and foreign key cascades.
- **Statistical & Aggregative Analysis:** Compute accurate statistical summaries (daily and monthly minimum, maximum, mean temperatures; relative humidity metrics; monthly precipitation sums; Pearson correlation coefficients; and statistical anomaly detection via Z-scores) based solely on verified observations.
- **Interactive Data Visualization:** Provide a responsive, accessible React-based single-page application (SPA) featuring dynamic charts (Recharts) and filtering capabilities, complemented by a publication-quality scientific visualization engine in Python (Matplotlib).
- **Data Portability:** Enable export of filtered weather records, daily summaries, and data-quality audit logs to CSV for academic reporting.

---

## 2. Project Scope

### In-Scope Functional Modules
- **Historical Observations Ingestion:** Bulk CSV file ingestion via multipart HTTP upload.
- **Data Cleaning & Anomaly Detection:** Validation against terrestrial meteorological bounds and database uniqueness rules.
- **Observational Analytics:** Daily summary metrics, monthly aggregate totals, and inter-station temperature comparisons.
- **Visual Analytics:** Interactive web-based time-series charts (temperature trend, humidity trend, rainfall volume) and publication-ready static charts generated via Matplotlib.
- **Quality Audit & Logging:** Tracking upload batches and recording row-level anomalies without interrupting legitimate records in valid batches.
- **Data Export:** Filtered data extraction into standard CSV formats.

### Explicit Out-of-Scope Exclusions
- **Weather Forecasting & Prediction:** In accordance with the project requirements, no time-series forecasting (ARIMA, Prophet, LSTM), statistical extrapolation, or future weather claims are implemented.
- **Real-Time IoT Streaming:** The system operates on batched historical observation records rather than sub-second MQTT/WebSocket telemetry streams.

---

## 3. System Architecture

The application adopts a decoupled, multi-tier client-server architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Presentation Tier (Frontend)                     │
│               React 19 + Vite 8 + Recharts + Plain CSS                 │
│  - Overview Dashboard   - Weather Records Grid   - CSV Upload & Audit  │
│  - Daily Summary Table  - Monthly Analysis View  - Dynamic Charts      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / RESTful API (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Application Tier (Backend)                      │
│                  Node.js + Express 5.3 Framework                       │
│  - Route Controllers    - Transaction Services   - Ingestion Pipeline  │
│  - Multer File Upload   - CSV Stream Parser      - Connection Pool     │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ Parameterized SQL              │ CLI Spawn (Safe args)
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│          Persistence Tier            │  │     Data Science Engine      │
│       MySQL 8.0 Database             │  │   Python 3.15 + Virtualenv   │
│  - `weather_records`                 │  │  - Pandas 3.0 / NumPy 2.5    │
│  - `import_batches`                  │  │  - Matplotlib 3.11           │
│  - `data_quality_issues`             │  │  - Anomaly & Chart Pipeline  │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### Component Details
1. **Frontend (React 19, Vite, Plain CSS):**
   - Configured with Vite development server on port `5173`.
   - Utilizes `react-router-dom` for client-side routing.
   - Built with plain, modular CSS using CSS custom properties for a clean, accessible dark interface. No CSS frameworks (such as Tailwind or Bootstrap) were used, adhering strictly to core web standards.
   - Implements Recharts for responsive SVG-based data visualizations.
2. **Backend (Express 5.3, Node.js):**
   - Runs on port `5000`.
   - Utilizes `mysql2/promise` with an optimized connection pool (10 connections, queue limit 0).
   - Ingestion handled via `multer` (in-memory storage / clean disk buffer) and streaming parser (`csv-parse/sync`).
   - Child process management invokes Python analytics safely without shell injection risks (`shell: false`).
3. **Database (MySQL 8.0 Community Server):**
   - Relational persistence in database `weather_analysis`.
   - ACID-compliant transactional execution with rollback on catastrophic failure.
4. **Analytics Engine (Python 3.15 in `.venv`):**
   - Modular scripts: `validate_data.py`, `analyze_weather.py`, `generate_charts.py`.
   - Diagnostic output routed to `stderr`; structured machine-readable payload emitted as JSON to `stdout`.

---

## 4. Database Design & Tables

The schema comprises three core tables designed in Third Normal Form (3NF):

```
 ┌─────────────────────────┐           1:N          ┌─────────────────────────┐
 │     import_batches      │───────────────────────<│   data_quality_issues   │
 ├─────────────────────────┤                        ├─────────────────────────┤
 │ PK  batch_id            │                        │ PK  issue_id            │
 │     filename            │                        │ FK  batch_id            │
 │     total_rows          │                        │     source_row_number   │
 │     accepted_rows       │                        │     field_name          │
 │     rejected_rows       │                        │     issue_description   │
 │     imported_at         │                        │     raw_value           │
 └─────────────────────────┘                        │     resolved            │
                                                    │     created_at          │
                                                    └─────────────────────────┘

 ┌─────────────────────────┐
 │     weather_records     │
 ├─────────────────────────┤
 │ PK  record_id           │
 │ UK  observation_date    │──┐
 │ UK  location            │──┴─ Composite Unique: `uq_date_location`
 │     temperature         │
 │     humidity            │
 │     rainfall            │
 │     created_at          │
 └─────────────────────────┘
```

### Table 1: `import_batches`
Tracks upload provenance, metadata, and high-level ingestion outcomes:
- `batch_id` (`BIGINT UNSIGNED`, `AUTO_INCREMENT`, `PRIMARY KEY`): Unique batch identifier.
- `filename` (`VARCHAR(255)`, `NOT NULL`): Original uploaded file name.
- `total_rows` (`INT UNSIGNED`, `DEFAULT 0`): Total lines evaluated in source CSV.
- `accepted_rows` (`INT UNSIGNED`, `DEFAULT 0`): Count of clean rows committed.
- `rejected_rows` (`INT UNSIGNED`, `DEFAULT 0`): Count of rejected rows containing anomalies.
- `imported_at` (`TIMESTAMP`, `DEFAULT CURRENT_TIMESTAMP`): Ingestion timestamp.

### Table 2: `weather_records`
Stores verified historical observations:
- `record_id` (`BIGINT UNSIGNED`, `AUTO_INCREMENT`, `PRIMARY KEY`): Unique record surrogate key.
- `observation_date` (`DATE`, `NOT NULL`): Date of observational record (ISO 8601 `YYYY-MM-DD`).
- `location` (`VARCHAR(100)`, `NOT NULL`): Meteorological station name.
- `temperature` (`DECIMAL(5,2)`, `NULL`): Ambient temperature in degrees Celsius ($^\circ\text{C}$).
- `humidity` (`DECIMAL(5,2)`, `NULL`): Relative humidity percentage ($\%$, $0.00$ to $100.00$).
- `rainfall` (`DECIMAL(7,2)`, `NULL`): 24-hour cumulative rainfall in millimeters ($\text{mm}$).
- `created_at` (`TIMESTAMP`, `DEFAULT CURRENT_TIMESTAMP`): Record insertion timestamp.
- **Constraints & Indexes**:
  - `UNIQUE KEY uq_date_location (observation_date, location)`: Guarantees that at most one observational record exists per location per calendar day.
  - `KEY idx_date_location (observation_date, location)`: Optimizes multi-column range scans and filter queries.

### Table 3: `data_quality_issues`
Maintains row-level audit logs for all rejected data:
- `issue_id` (`BIGINT UNSIGNED`, `AUTO_INCREMENT`, `PRIMARY KEY`): Audit entry identifier.
- `batch_id` (`BIGINT UNSIGNED`, `NOT NULL`): Foreign key referencing `import_batches(batch_id)` with `ON DELETE CASCADE`.
- `source_row_number` (`INT UNSIGNED`, `NOT NULL`): 1-indexed row position in the source CSV file, enabling exact data correction.
- `field_name` (`VARCHAR(100)`, `NOT NULL`): Erroneous attribute (e.g., `temperature`, `humidity`, `observation_date`).
- `issue_description` (`VARCHAR(500)`, `NOT NULL`): Specific validation violation message.
- `raw_value` (`VARCHAR(255)`, `NULL`): Exact invalid string as extracted from the input stream.
- `resolved` (`TINYINT(1)`, `DEFAULT 0`): Governance flag for auditing workflows.
- `created_at` (`TIMESTAMP`, `DEFAULT CURRENT_TIMESTAMP`): Audit record creation time.

---

## 5. Ingestion & Quality Assurance Methodology

### 5.1 Validation Rules & Meteorological Bounds
Every incoming row is subjected to the following rule matrix:

| Field | Rule / Bound | Action on Violation |
| :--- | :--- | :--- |
| `observation_date` | Must conform to valid ISO date format (`YYYY-MM-DD`). Future dates ($> \text{Current Date}$) are rejected. | Row Rejected; logged to `data_quality_issues`. |
| `location` | Non-empty string; trimmed; $\le 100$ characters. | Row Rejected; logged to `data_quality_issues`. |
| `temperature` | Plausible terrestrial limits: $-60.0^\circ\text{C} \le T \le +60.0^\circ\text{C}$. | Value set to `NULL` or row rejected if unparseable; logged to issues. |
| `humidity` | Relative percentage bounds: $0.0\% \le H \le 100.0\%$. | Value set to `NULL` or row rejected if unparseable; logged to issues. |
| `rainfall` | Precipitation non-negativity constraint: $R \ge 0.0\text{ mm}$. | Row rejected; logged to `data_quality_issues`. |
| `(date, location)` | Uniqueness against database records AND intra-batch records. | Duplicate rejected; logged as duplicate record issue. |

### 5.2 Preservation of Missing Values (NULL Integrity)
A vital design principle implemented across the system is:
$$\text{Missing Observation} \neq 0$$
If an observation station recorded rainfall but its thermometer failed, temperature is stored as `NULL`. In SQL aggregations, `AVG(temperature)` and `COUNT(temperature)` automatically ignore `NULL` entries rather than distorting the mean downward with false zeroes.

### 5.3 Transactional Safety & Atomicity
The CSV ingestion service (`backend/services/importService.js`) wraps the batch processing inside an explicit MySQL transaction:
```javascript
const connection = await pool.getConnection();
await connection.beginTransaction();
try {
  // 1. Create batch entry
  // 2. Stream and validate CSV rows
  // 3. Insert valid rows in batch
  // 4. Insert data quality audit entries
  // 5. Update batch totals
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```
If an unhandled database error occurs during ingestion, all changes are rolled back, preventing orphaned rows.

---

## 6. Statistical Analysis Methodology

The analytical engine executes descriptive statistical computations using both SQL window aggregations and Python Pandas/NumPy routines.

### 6.1 Daily and Monthly Aggregates
- **Daily Aggregates**:
  For any date $d$ and station $L$:
  $$\bar{T}_d = \frac{1}{N}\sum_{i=1}^{N} T_i, \quad T_{\min, d} = \min(T_i), \quad T_{\max, d} = \max(T_i)$$
  $$\bar{H}_d = \frac{1}{N}\sum_{i=1}^{N} H_i, \quad R_{\text{total}, d} = \sum_{i=1}^{N} R_i$$
- **Monthly Summary**:
  $$\text{Rainfall}_{\text{month}} = \sum_{j=1}^{M} R_j$$
  $$\bar{T}_{\text{month}} = \frac{\sum_{j=1}^{M} T_j}{\text{Count}(T)}$$

### 6.2 Anomaly Detection via Z-Score
In `analysis/analyze_weather.py`, statistical anomalies in daily temperature are identified using standard score normalization:
$$Z_i = \frac{x_i - \mu}{\sigma}$$
Observations with $|Z_i| > 2.5$ are flagged as statistical anomalies for meteorological review.

### 6.3 Pearson Correlation
The engine computes the linear correlation between ambient temperature and relative humidity:
$$r_{T,H} = \frac{\sum (T_i - \bar{T})(H_i - \bar{H})}{\sqrt{\sum(T_i - \bar{T})^2 \sum(H_i - \bar{H})^2}}$$
Demonstrating the expected inverse relationship between temperature and relative humidity in terrestrial environments.

---

## 7. Results & Visualizations

### 7.1 Web Application Dashboard
The React frontend delivers six specialized modules:
1. **Overview Dashboard**: High-level KPI cards displaying total accepted records, monitored station count, date coverage range, average temperature ($^\circ\text{C}$), average humidity ($\%$), and total rainfall ($\text{mm}$).
2. **Weather Records Explorer**: Interactive table supporting multi-field filtering by meteorological station, start date, and end date, complete with server-side pagination and sorting.
3. **Daily Summary**: Aggregate daily table with station-level filtering and CSV export.
4. **Monthly Analysis**: Station-by-station comparison grid tracking monthly precipitation totals and mean temperature fluctuations.
5. **Interactive Charts**: Responsive time-series charts using Recharts:
   - Line chart for daily temperature trends.
   - Dual-axis area/line chart for relative humidity trends.
   - Bar chart for monthly rainfall distribution.
6. **Data Quality Governance**: Complete batch upload audit log displaying accepted vs. rejected counts, with drill-down views displaying exact CSV row numbers, fields, and error reasons.

### 7.2 Publication-Quality Matplotlib Visualizations
The Python engine generates six 300-DPI charts in `analysis/charts/`:
- `temperature_trends.png`: Multi-station temperature time-series with legend and unit labels.
- `monthly_rainfall.png`: Monthly precipitation volume comparisons across stations.
- `monthly_temperature_comparison.png`: Clustered bar chart of station thermal differences.
- `humidity_trends.png`: Relative humidity progression over observation periods.
- `temperature_distribution.png`: Histogram and kernel density representation.
- `humidity_rainfall_scatter.png`: Scatter plot correlating precipitation events with ambient humidity.

---

## 8. Testing & Quality Assurance

A rigorous three-tier testing strategy was implemented and verified:

### 8.1 Backend Integration Test Suite
Implemented in `backend/scripts/test-backend.js`, covering 37 programmatic assertions:
- **Health Check**: Validated real MySQL connectivity via `/api/health`.
- **Filtering & Pagination**: Verified query parameters (`location`, `startDate`, `endDate`, `limit`, `page`).
- **Aggregation Correctness**: Validated daily summaries, monthly summaries, and KPI statistics against database rows.
- **CSV Ingestion Pipeline**: Tested multipart upload of valid files and verified row counts in `import_batches`.
- **Duplicate Prevention**: Verified rejection of duplicate `(date, location)` combinations.
- **Data Quality Logging**: Verified that invalid rows are logged with accurate `source_row_number` and field names.
- **CSV Export Endpoints**: Verified RFC 4180 CSV generation and headers for record downloads.

**Result**: **37 / 37 Assertions Passed (100% Success Rate).**

### 8.2 Python Analytics Test Suite
Implemented in `analysis/test_analysis.py`, covering 7 comprehensive unit test routines:
- `test_validate_data_clean`: Validates clean CSV acceptance.
- `test_validate_data_anomalies`: Validates detection of invalid dates, extreme temperatures, out-of-range humidity, and negative rainfall.
- `test_analyze_weather_aggregates`: Verifies Pandas grouping calculations for daily and monthly statistics.
- `test_missing_values_preservation`: Confirms that missing values are never coerced to zero.
- `test_pearson_correlation`: Verifies numerical stability of correlation calculations.
- `test_anomaly_detection_zscore`: Verifies detection of $|Z| > 2.5$ outliers.
- `test_generate_charts`: Verifies that all 6 Matplotlib charts are rendered to disk with non-zero file sizes.

**Result**: **7 / 7 Unit Tests Passed (100% Success Rate).**

### 8.3 Frontend Production Build
Compiled using Vite 8 with Rollup:
- Zero syntax errors, zero unresolved imports, zero lint warnings.
- Production bundle created in `frontend/dist/` in 266 ms.

---

## 9. System Limitations & Future Work

### Current System Limitations
1. **Single-Node Relational Storage**: MySQL is deployed as a single-node instance. While adequate for historical college datasets (hundreds of thousands of records), multi-gigabyte observational streams would require partitioning or distributed column-store engines (e.g., ClickHouse).
2. **Historical Scope Only**: The system purposefully does not forecast future weather conditions. Users requiring predictive weather estimates must ingest data into an external numerical weather prediction (NWP) model.
3. **Daily Granularity**: Current database indexing and schema focus on daily observational units rather than minute-by-minute high-frequency sensor readings.

### Recommended Future Enhancements
- Integration of geospatial GIS mapping (e.g., Leaflet or Mapbox) to display observation stations on an interactive geographical map.
- Automated scheduled database backup scripts using `mysqldump` and cron/systemd timers.
- Role-based access control (RBAC) separating view-only student researchers from administrative data stewards authorized to upload new batches.

---

## 10. Conclusion

The **Weather Data Analysis System** successfully meets all project requirements. By combining a clean, responsive React frontend with an Express/MySQL backend and a Python scientific computing engine, the system delivers reliable historical weather data management. The project proves that rigorous data validation, explicit preservation of missing values, and transparent audit trails provide superior analytical accuracy compared to naive automated ingestion workflows.

---

**Report Prepared By:** Engineering Project Candidate  
**Academic Year:** 2026–2027  
**Submission Status:** Completed & Fully Verified  
