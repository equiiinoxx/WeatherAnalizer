"""
Weather Data Statistical Analysis Engine
Performs parametric and non-parametric historical climate computations, daily & monthly aggregations,
precipitation sums, regional temperature comparisons, and triggers chart generation.
All diagnostics are directed to stderr; pristine JSON is output to stdout.
Strictly historical observations; no predictive modeling.
"""

import os
import sys
import json
import argparse
import datetime
import numpy as np
import pandas as pd
import mysql.connector

# Import internal modules
try:
    from generate_charts import generate_all_charts
    from validate_data import validate_dataframe
except ImportError:
    from analysis.generate_charts import generate_all_charts
    from analysis.validate_data import validate_dataframe

def get_db_connection():
    """
    Connect to MySQL using environment variables or backend/.env configuration.
    """
    host = os.environ.get('DB_HOST', 'localhost')
    port = int(os.environ.get('DB_PORT', 3306))
    user = os.environ.get('DB_USER', 'root')
    password = os.environ.get('DB_PASSWORD', '')
    database = os.environ.get('DB_NAME', 'weather_analysis')

    # Fallback to reading backend/.env if DB_PASSWORD is not in environment
    if not password and os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')):
        env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"\'')
                        if k == 'DB_HOST': host = v
                        elif k == 'DB_PORT': port = int(v)
                        elif k == 'DB_USER': user = v
                        elif k == 'DB_PASSWORD': password = v
                        elif k == 'DB_NAME': database = v
        except Exception as env_err:
            sys.stderr.write(f"Warning: Failed to parse backend/.env: {env_err}\n")

    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database
    )

def fetch_data_from_db(location=None, start_date=None, end_date=None):
    """
    Fetch historical records from MySQL weather_records table.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    conditions = []
    params = []

    if location and location != 'ALL':
        conditions.append("location = %s")
        params.append(location)

    if start_date:
        conditions.append("observation_date >= %s")
        params.append(start_date)

    if end_date:
        conditions.append("observation_date <= %s")
        params.append(end_date)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT record_id, 
               DATE_FORMAT(observation_date, '%Y-%m-%d') AS observation_date, 
               location, 
               CAST(temperature AS DECIMAL(5,2)) AS temperature, 
               CAST(humidity AS DECIMAL(5,2)) AS humidity, 
               CAST(rainfall AS DECIMAL(7,2)) AS rainfall 
        FROM weather_records 
        {where_clause}
        ORDER BY observation_date ASC
    """

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return pd.DataFrame(rows)

def compute_analysis(df, location_filter=None, generate_plots=True):
    """
    Performs comprehensive statistical analysis using Pandas and NumPy.
    """
    if df is None or df.empty:
        return {
            "status": "empty",
            "message": "No historical weather observations found matching query criteria.",
            "total_records": 0
        }

    # Clean and cast columns
    df = df.copy()
    df['observation_date'] = pd.to_datetime(df['observation_date'])
    df['temperature'] = pd.to_numeric(df['temperature'], errors='coerce')
    df['humidity'] = pd.to_numeric(df['humidity'], errors='coerce')
    df['rainfall'] = pd.to_numeric(df['rainfall'], errors='coerce')

    df['year'] = df['observation_date'].dt.year
    df['month'] = df['observation_date'].dt.month
    df['month_name'] = df['observation_date'].dt.strftime('%b %Y')
    df['cal_month'] = df['observation_date'].dt.strftime('%b')
    df['date_str'] = df['observation_date'].dt.strftime('%Y-%m-%d')

    total_records = len(df)
    min_date = df['date_str'].min()
    max_date = df['date_str'].max()

    # -------------------------------------------------------------
    # 1. Descriptive Summary Statistics (Min, Max, Mean)
    # -------------------------------------------------------------
    desc_stats = {}
    for var in ['temperature', 'humidity', 'rainfall']:
        series = df[var].dropna()
        if not series.empty:
            arr = series.to_numpy()
            desc_stats[var] = {
                "count": int(series.count()),
                "missing_count": int(df[var].isna().sum()),
                "mean": round(float(np.mean(arr)), 2),
                "min": round(float(np.min(arr)), 2),
                "max": round(float(np.max(arr)), 2)
            }

    # -------------------------------------------------------------
    # 2. Daily Aggregations (Min, Max, Avg Temperature, Humidity, Rainfall)
    # -------------------------------------------------------------
    daily_groups = df.groupby('date_str').agg(
        avg_temperature=('temperature', 'mean'),
        min_temperature=('temperature', 'min'),
        max_temperature=('temperature', 'max'),
        avg_humidity=('humidity', 'mean'),
        min_humidity=('humidity', 'min'),
        max_humidity=('humidity', 'max'),
        avg_rainfall=('rainfall', 'mean'),
        min_rainfall=('rainfall', 'min'),
        max_rainfall=('rainfall', 'max'),
        total_rainfall=('rainfall', 'sum'),
        station_count=('location', 'nunique')
    ).reset_index()

    daily_summary = []
    for _, r in daily_groups.head(30).iterrows():  # Top sample for JSON preview
        daily_summary.append({
            "date": r['date_str'],
            "avg_temperature": round(r['avg_temperature'], 2) if pd.notna(r['avg_temperature']) else None,
            "min_temperature": round(r['min_temperature'], 2) if pd.notna(r['min_temperature']) else None,
            "max_temperature": round(r['max_temperature'], 2) if pd.notna(r['max_temperature']) else None,
            "avg_humidity": round(r['avg_humidity'], 2) if pd.notna(r['avg_humidity']) else None,
            "avg_rainfall": round(r['avg_rainfall'], 2) if pd.notna(r['avg_rainfall']) else None,
            "total_rainfall": round(r['total_rainfall'], 2) if pd.notna(r['total_rainfall']) else 0.0
        })

    # -------------------------------------------------------------
    # 3. Monthly Aggregations & Rainfall Totals
    # -------------------------------------------------------------
    monthly_groups = df.groupby(['year', 'month']).agg(
        period_label=('month_name', 'first'),
        cal_month=('cal_month', 'first'),
        record_count=('observation_date', 'count'),
        avg_temperature=('temperature', 'mean'),
        min_temperature=('temperature', 'min'),
        max_temperature=('temperature', 'max'),
        avg_humidity=('humidity', 'mean'),
        min_humidity=('humidity', 'min'),
        max_humidity=('humidity', 'max'),
        avg_rainfall=('rainfall', 'mean'),
        total_rainfall=('rainfall', 'sum'),
        max_rainfall=('rainfall', 'max')
    ).reset_index().sort_values(['year', 'month'])

    monthly_summary = []
    for _, r in monthly_groups.iterrows():
        monthly_summary.append({
            "period": r['period_label'],
            "year": int(r['year']),
            "month": int(r['month']),
            "cal_month": r['cal_month'],
            "record_count": int(r['record_count']),
            "avg_temperature": round(r['avg_temperature'], 2) if pd.notna(r['avg_temperature']) else None,
            "min_temperature": round(r['min_temperature'], 2) if pd.notna(r['min_temperature']) else None,
            "max_temperature": round(r['max_temperature'], 2) if pd.notna(r['max_temperature']) else None,
            "avg_humidity": round(r['avg_humidity'], 2) if pd.notna(r['avg_humidity']) else None,
            "total_rainfall": round(r['total_rainfall'], 2) if pd.notna(r['total_rainfall']) else 0.0,
            "max_single_day_rainfall": round(r['max_rainfall'], 2) if pd.notna(r['max_rainfall']) else 0.0
        })

    # -------------------------------------------------------------
    # 4. Compare Monthly Average Temperatures Across Locations
    # -------------------------------------------------------------
    loc_monthly = df.groupby(['cal_month', 'month', 'location'])['temperature'].mean().reset_index()
    loc_monthly = loc_monthly.sort_values('month')

    monthly_temp_comparison = {}
    for cal_m in loc_monthly['cal_month'].unique():
        sub = loc_monthly[loc_monthly['cal_month'] == cal_m]
        monthly_temp_comparison[cal_m] = {
            row['location']: round(float(row['temperature']), 2) for _, row in sub.iterrows() if pd.notna(row['temperature'])
        }

    # Location overall summary
    loc_overall = []
    for loc, group in df.groupby('location'):
        loc_overall.append({
            "location": loc,
            "record_count": int(len(group)),
            "avg_temperature": round(float(group['temperature'].mean()), 2) if pd.notna(group['temperature'].mean()) else None,
            "min_temperature": round(float(group['temperature'].min()), 2) if pd.notna(group['temperature'].min()) else None,
            "max_temperature": round(float(group['temperature'].max()), 2) if pd.notna(group['temperature'].max()) else None,
            "avg_humidity": round(float(group['humidity'].mean()), 2) if pd.notna(group['humidity'].mean()) else None,
            "total_rainfall": round(float(group['rainfall'].sum()), 2) if pd.notna(group['rainfall'].sum()) else 0.0,
            "max_rainfall": round(float(group['rainfall'].max()), 2) if pd.notna(group['rainfall'].max()) else 0.0
        })

    # -------------------------------------------------------------
    # 5. Chart Generation (Required Matplotlib Figures)
    # -------------------------------------------------------------
    chart_files = []
    if generate_plots:
        try:
            charts_map = generate_all_charts(df, location_filter=location_filter)
            chart_files = list(charts_map.values())
        except Exception as chart_err:
            sys.stderr.write(f"Chart generation error: {chart_err}\n")

    return {
        "status": "success",
        "total_records": total_records,
        "date_range": {
            "start": min_date,
            "end": max_date
        },
        "descriptive_statistics": desc_stats,
        "daily_aggregations_sample": daily_summary,
        "monthly_aggregations": monthly_summary,
        "monthly_temperature_comparison": monthly_temp_comparison,
        "location_summary": loc_overall,
        "charts": chart_files
    }

def main():
    parser = argparse.ArgumentParser(description="Weather Data Analysis System — Historical Observations Engine")
    parser.add_argument('--csv', help="Path to input CSV (if not querying MySQL)")
    parser.add_argument('--location', help="Filter by specific monitoring location")
    parser.add_argument('--start-date', help="Filter observations >= start-date (YYYY-MM-DD)")
    parser.add_argument('--end-date', help="Filter observations <= end-date (YYYY-MM-DD)")
    parser.add_argument('--no-charts', action='store_true', help="Skip generating Matplotlib PNG charts")
    args = parser.parse_args()

    try:
        if args.csv:
            sys.stderr.write(f"Reading observation data from CSV: {args.csv}\n")
            if not os.path.exists(args.csv):
                raise FileNotFoundError(f"CSV file not found: {args.csv}")
            df = pd.read_csv(args.csv)
            # Run quick validation on input CSV
            val_result = validate_dataframe(df)
            df = val_result['cleaned_df']
            if df.empty:
                print(json.dumps({
                    "status": "empty",
                    "message": "Input CSV had no accepted valid observations",
                    "validation_issues": val_result['issues']
                }, indent=2))
                return
        else:
            sys.stderr.write("Connecting to MySQL weather_records...\n")
            df = fetch_data_from_db(
                location=args.location,
                start_date=args.start_date,
                end_date=args.end_date
            )

        result = compute_analysis(
            df,
            location_filter=args.location,
            generate_plots=not args.no_charts
        )

        # Output strictly JSON to stdout
        print(json.dumps(result, indent=2))

    except Exception as ex:
        sys.stderr.write(f"Analysis engine error: {str(ex)}\n")
        print(json.dumps({
            "status": "error",
            "message": str(ex)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
