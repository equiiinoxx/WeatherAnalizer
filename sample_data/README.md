# Sample Weather Data

> **IMPORTANT DISCLAIMER**:
> All datasets located in this directory (`sample_data/`) are **purely illustrative sample data** synthesized for demonstration, testing, and validation of the Weather Data Analysis System. They are **NOT** official or verified meteorological observations.

## Files in this Directory

1. `weather_data.csv`:
   - A valid sample dataset containing 35 clean historical records across 5 stations (`New Delhi`, `Mumbai`, `Bengaluru`, `Kolkata`, `Shimla`) for January 1–7, 2023.
   - Used for primary import testing, statistical pipeline evaluation, and dashboard visualization.

2. `weather_data_invalid.csv`:
   - A dedicated test dataset containing 13 rows specifically designed to trigger and test every data-quality validation rule:
     - Out-of-bounds high temperature (`155.0°C`)
     - Out-of-bounds low temperature (`-95.0°C`)
     - Non-numeric temperature (`hot`)
     - Out-of-bounds humidity (`140.0%` and `-10.0%`)
     - Negative rainfall (`-12.5 mm`)
     - Non-numeric rainfall (`rainy`)
     - Missing location (empty field)
     - Unparseable date (`not-a-valid-date`)
     - Future observation date (`2099-01-01` rejected for historical analysis)
     - Intra-batch duplicate records (`2023-02-10` in Kolkata repeated)

3. `sample_weather_historical.csv`:
   - Comprehensive multi-month sample dataset (723 observations across 6 locations) for extensive performance testing.

4. `sample_weather_with_anomalies.csv`:
   - Anomaly sample dataset for validating Python-side validation scripts.
