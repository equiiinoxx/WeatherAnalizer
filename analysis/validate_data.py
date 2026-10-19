"""
Weather Data Validation Module
Validates raw historical weather observations from CSV files or Pandas DataFrames.
Strictly historical observations; detects missing values, invalid dates, non-numeric measurements,
out-of-range humidity, negative rainfall, implausible temperatures, and duplicate records.
"""

import sys
import os
import json
import datetime
import pandas as pd
import numpy as np

REQUIRED_COLUMNS = ['observation_date', 'location', 'temperature', 'humidity', 'rainfall']

# Documented terrestrial physical limits for weather observations
PLAUSIBLE_TEMP_MIN = -60.0  # °C
PLAUSIBLE_TEMP_MAX = 60.0   # °C
HUMIDITY_MIN = 0.0          # %
HUMIDITY_MAX = 100.0        # %
RAINFALL_MIN = 0.0          # mm
RAINFALL_MAX = 1500.0       # mm

def is_null_or_na(val):
    if val is None:
        return True
    if isinstance(val, (float, np.floating)) and np.isnan(val):
        return True
    if isinstance(val, str):
        cleaned = val.strip().lower()
        return cleaned in ('', 'na', 'n/a', 'null', 'nan', 'none', '-')
    return False

def validate_dataframe(df, existing_keys=None):
    """
    Validates a DataFrame of weather observations.
    Returns:
        dict: {
            "is_valid": bool,
            "total_rows": int,
            "accepted_rows": int,
            "rejected_rows": int,
            "issues": list,
            "breakdown": dict,
            "cleaned_df": pd.DataFrame
        }
    """
    if df is None or df.empty:
        return {
            "is_valid": False,
            "total_rows": 0,
            "accepted_rows": 0,
            "rejected_rows": 0,
            "issues": [{"source_row_number": 0, "field_name": "dataset", "issue_description": "Dataset is empty", "raw_value": None}],
            "breakdown": {"missing_required": 0, "invalid_values": 0, "duplicates": 0, "missing_measurements": 0},
            "cleaned_df": pd.DataFrame(columns=REQUIRED_COLUMNS)
        }

    # Normalize column names: lower-cased and stripped
    col_map = {}
    normalized_cols = {}
    for col in df.columns:
        clean = str(col).strip().lower().replace(' ', '_').replace('-', '_')
        normalized_cols[clean] = col

    # Check required columns
    missing_cols = [req for req in REQUIRED_COLUMNS if req not in normalized_cols]
    if missing_cols:
        return {
            "is_valid": False,
            "total_rows": len(df),
            "accepted_rows": 0,
            "rejected_rows": len(df),
            "issues": [{
                "source_row_number": 1,
                "field_name": "header",
                "issue_description": f"Missing required column(s): {missing_cols}. Expected: {REQUIRED_COLUMNS}",
                "raw_value": str(list(df.columns))
            }],
            "breakdown": {"missing_required": len(df), "invalid_values": 0, "duplicates": 0, "missing_measurements": 0},
            "cleaned_df": pd.DataFrame(columns=REQUIRED_COLUMNS)
        }

    # Standardize column access
    date_col = normalized_cols['observation_date']
    loc_col = normalized_cols['location']
    temp_col = normalized_cols['temperature']
    hum_col = normalized_cols['humidity']
    rain_col = normalized_cols['rainfall']

    seen_batch_keys = {}
    db_keys = set(existing_keys) if existing_keys else set()

    issues = []
    accepted_rows = []

    missing_required_count = 0
    invalid_values_count = 0
    duplicate_count = 0
    missing_measurements_count = 0

    today = datetime.date.today()

    for idx, row in df.iterrows():
        source_row_num = idx + 2  # 1-indexed, line 1 is header
        row_rejected = False
        row_issues = []

        raw_date = row[date_col]
        raw_loc = row[loc_col]
        raw_temp = row[temp_col]
        raw_hum = row[hum_col]
        raw_rain = row[rain_col]

        # 1. Validate observation_date
        clean_date = None
        if is_null_or_na(raw_date):
            row_rejected = True
            missing_required_count += 1
            row_issues.append({
                "source_row_number": source_row_num,
                "field_name": "observation_date",
                "issue_description": "Missing required observation_date",
                "raw_value": str(raw_date) if raw_date is not None else ""
            })
        else:
            try:
                parsed_date = pd.to_datetime(raw_date, errors='raise').date()
                if parsed_date > today:
                    row_rejected = True
                    invalid_values_count += 1
                    row_issues.append({
                        "source_row_number": source_row_num,
                        "field_name": "observation_date",
                        "issue_description": "Observation date cannot be in the future (strictly historical data)",
                        "raw_value": str(raw_date)
                    })
                else:
                    clean_date = parsed_date.strftime('%Y-%m-%d')
            except Exception:
                row_rejected = True
                invalid_values_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "observation_date",
                    "issue_description": "Invalid date format; unable to parse date",
                    "raw_value": str(raw_date)
                })

        # 2. Validate location
        clean_loc = None
        if is_null_or_na(raw_loc):
            row_rejected = True
            missing_required_count += 1
            row_issues.append({
                "source_row_number": source_row_num,
                "field_name": "location",
                "issue_description": "Missing required location identifier",
                "raw_value": str(raw_loc) if raw_loc is not None else ""
            })
        else:
            clean_loc = str(raw_loc).strip()
            if len(clean_loc) == 0:
                row_rejected = True
                missing_required_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "location",
                    "issue_description": "Location cannot be an empty string",
                    "raw_value": ""
                })
            elif len(clean_loc) > 100:
                row_rejected = True
                invalid_values_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "location",
                    "issue_description": "Location name exceeds maximum permitted length of 100 characters",
                    "raw_value": clean_loc
                })

        # 3. Check Duplicate Records
        if clean_date and clean_loc:
            composite_key = f"{clean_date}:::{clean_loc.lower()}"
            if composite_key in seen_batch_keys:
                prior_row = seen_batch_keys[composite_key]
                row_rejected = True
                duplicate_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "observation_date,location",
                    "issue_description": f"Duplicate observation: matches earlier row {prior_row} for location '{clean_loc}' on {clean_date}",
                    "raw_value": f"{clean_date} | {clean_loc}"
                })
            elif composite_key in db_keys:
                row_rejected = True
                duplicate_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "observation_date,location",
                    "issue_description": f"Duplicate observation: record for location '{clean_loc}' on {clean_date} already exists in database",
                    "raw_value": f"{clean_date} | {clean_loc}"
                })
            else:
                seen_batch_keys[composite_key] = source_row_num

        # 4. Validate Temperature
        clean_temp = None
        if is_null_or_na(raw_temp):
            clean_temp = None
            missing_measurements_count += 1
        else:
            try:
                temp_val = float(raw_temp)
                if np.isnan(temp_val):
                    clean_temp = None
                    missing_measurements_count += 1
                elif temp_val < PLAUSIBLE_TEMP_MIN or temp_val > PLAUSIBLE_TEMP_MAX:
                    row_rejected = True
                    invalid_values_count += 1
                    row_issues.append({
                        "source_row_number": source_row_num,
                        "field_name": "temperature",
                        "issue_description": f"Implausible temperature: {temp_val}°C is outside plausible bounds ({PLAUSIBLE_TEMP_MIN}°C to {PLAUSIBLE_TEMP_MAX}°C)",
                        "raw_value": str(raw_temp)
                    })
                else:
                    clean_temp = round(temp_val, 2)
            except (ValueError, TypeError):
                row_rejected = True
                invalid_values_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "temperature",
                    "issue_description": "Non-numeric temperature measurement",
                    "raw_value": str(raw_temp)
                })

        # 5. Validate Humidity
        clean_hum = None
        if is_null_or_na(raw_hum):
            clean_hum = None
            missing_measurements_count += 1
        else:
            try:
                hum_val = float(raw_hum)
                if np.isnan(hum_val):
                    clean_hum = None
                    missing_measurements_count += 1
                elif hum_val < HUMIDITY_MIN or hum_val > HUMIDITY_MAX:
                    row_rejected = True
                    invalid_values_count += 1
                    row_issues.append({
                        "source_row_number": source_row_num,
                        "field_name": "humidity",
                        "issue_description": f"Out-of-range humidity: {hum_val}% must be between {HUMIDITY_MIN}% and {HUMIDITY_MAX}%",
                        "raw_value": str(raw_hum)
                    })
                else:
                    clean_hum = round(hum_val, 2)
            except (ValueError, TypeError):
                row_rejected = True
                invalid_values_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "humidity",
                    "issue_description": "Non-numeric relative humidity measurement",
                    "raw_value": str(raw_hum)
                })

        # 6. Validate Rainfall
        clean_rain = None
        if is_null_or_na(raw_rain):
            clean_rain = None
            missing_measurements_count += 1
        else:
            try:
                rain_val = float(raw_rain)
                if np.isnan(rain_val):
                    clean_rain = None
                    missing_measurements_count += 1
                elif rain_val < RAINFALL_MIN:
                    row_rejected = True
                    invalid_values_count += 1
                    row_issues.append({
                        "source_row_number": source_row_num,
                        "field_name": "rainfall",
                        "issue_description": f"Negative rainfall measurement ({rain_val} mm) is invalid",
                        "raw_value": str(raw_rain)
                    })
                elif rain_val > RAINFALL_MAX:
                    row_rejected = True
                    invalid_values_count += 1
                    row_issues.append({
                        "source_row_number": source_row_num,
                        "field_name": "rainfall",
                        "issue_description": f"Excessive single-day rainfall ({rain_val} mm) exceeds upper threshold ({RAINFALL_MAX} mm)",
                        "raw_value": str(raw_rain)
                    })
                else:
                    clean_rain = round(rain_val, 2)
            except (ValueError, TypeError):
                row_rejected = True
                invalid_values_count += 1
                row_issues.append({
                    "source_row_number": source_row_num,
                    "field_name": "rainfall",
                    "issue_description": "Non-numeric rainfall measurement",
                    "raw_value": str(raw_rain)
                })

        # 7. Check if all three measurements are missing
        if not row_rejected and clean_temp is None and clean_hum is None and clean_rain is None:
            row_rejected = True
            missing_required_count += 1
            row_issues.append({
                "source_row_number": source_row_num,
                "field_name": "measurements",
                "issue_description": "All three meteorological measurements are missing; row rejected",
                "raw_value": None
            })

        issues.extend(row_issues)

        if not row_rejected:
            accepted_rows.append({
                "observation_date": clean_date,
                "location": clean_loc,
                "temperature": clean_temp,
                "humidity": clean_hum,
                "rainfall": clean_rain
            })

    cleaned_df = pd.DataFrame(accepted_rows)

    return {
        "is_valid": len(issues) == 0,
        "total_rows": len(df),
        "accepted_rows": len(accepted_rows),
        "rejected_rows": len(df) - len(accepted_rows),
        "issues": issues,
        "breakdown": {
            "missing_required": missing_required_count,
            "invalid_values": invalid_values_count,
            "duplicates": duplicate_count,
            "missing_measurements_preserved_as_null": missing_measurements_count
        },
        "cleaned_df": cleaned_df
    }

def validate_csv_file(csv_path, existing_keys=None):
    """
    Validates a CSV file from disk.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path, dtype=str)
    return validate_dataframe(df, existing_keys=existing_keys)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python validate_data.py <path_to_csv>\n")
        sys.exit(1)

    filepath = sys.argv[1]
    try:
        report = validate_csv_file(filepath)
        # Exclude the cleaned_df from JSON stdout
        output_report = {
            "is_valid": report["is_valid"],
            "total_rows": report["total_rows"],
            "accepted_rows": report["accepted_rows"],
            "rejected_rows": report["rejected_rows"],
            "breakdown": report["breakdown"],
            "issues_count": len(report["issues"]),
            "issues": report["issues"][:50]  # Cap preview to 50
        }
        print(json.dumps(output_report, indent=2))
        sys.exit(0 if report["is_valid"] else 2)
    except Exception as ex:
        sys.stderr.write(f"Validation error: {str(ex)}\n")
        print(json.dumps({"error": str(ex)}))
        sys.exit(1)
