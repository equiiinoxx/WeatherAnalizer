import os
import sys
import json
import numpy as np
import pandas as pd
import mysql.connector

# Use non-GUI backend for Matplotlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def get_db_connection():
    # Prioritize environment variables passed from backend or system
    host = os.environ.get('DB_HOST', 'localhost')
    port = int(os.environ.get('DB_PORT', 3306))
    user = os.environ.get('DB_USER', 'root')
    password = os.environ.get('DB_PASSWORD', '')
    database = os.environ.get('DB_NAME', 'weather_analysis')

    # Fallback to reading backend/.env if env vars not populated
    if not password and os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')):
        env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
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

    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database
    )

def analyze():
    output_dir = os.path.join(os.path.dirname(__file__), 'charts')
    os.makedirs(output_dir, exist_ok=True)

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT record_id, observation_date, location, 
                   CAST(temperature AS DECIMAL(5,2)) as temperature, 
                   CAST(humidity AS DECIMAL(5,2)) as humidity, 
                   CAST(rainfall AS DECIMAL(7,2)) as rainfall 
            FROM weather_records 
            ORDER BY observation_date ASC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        df = pd.DataFrame(rows)
    except Exception as e:
        sys.stderr.write(f"Database query error: {str(e)}\n")
        print(json.dumps({"error": f"Failed to fetch data from database: {str(e)}"}))
        sys.exit(1)
        sys.stderr.write(f"Database query error: {str(e)}\n")
        print(json.dumps({"error": f"Failed to fetch data from database: {str(e)}"}))
        sys.exit(1)

    if df.empty:
        print(json.dumps({
            "status": "empty",
            "message": "No historical weather records found in database.",
            "total_records": 0
        }))
        sys.exit(0)

    # Convert types
    df['observation_date'] = pd.to_datetime(df['observation_date'])
    df['temperature'] = pd.to_numeric(df['temperature'], errors='coerce')
    df['humidity'] = pd.to_numeric(df['humidity'], errors='coerce')
    df['rainfall'] = pd.to_numeric(df['rainfall'], errors='coerce')
    df['month'] = df['observation_date'].dt.strftime('%b')
    df['month_num'] = df['observation_date'].dt.month

    # 1. Descriptive Statistics
    desc_stats = {}
    for col in ['temperature', 'humidity', 'rainfall']:
        series = df[col].dropna()
        if not series.empty:
            q25 = float(series.quantile(0.25))
            q75 = float(series.quantile(0.75))
            desc_stats[col] = {
                "count": int(series.count()),
                "mean": round(float(series.mean()), 2),
                "std": round(float(series.std()), 2),
                "min": round(float(series.min()), 2),
                "q25": round(q25, 2),
                "median": round(float(series.median()), 2),
                "q75": round(q75, 2),
                "max": round(float(series.max()), 2),
                "iqr": round(q75 - q25, 2),
                "skewness": round(float(series.skew()), 2)
            }

    # 2. Correlation Analysis
    corr_df = df[['temperature', 'humidity', 'rainfall']].corr()
    correlations = {
        "temp_humidity": round(float(corr_df.loc['temperature', 'humidity']), 3) if not np.isnan(corr_df.loc['temperature', 'humidity']) else 0,
        "temp_rainfall": round(float(corr_df.loc['temperature', 'rainfall']), 3) if not np.isnan(corr_df.loc['temperature', 'rainfall']) else 0,
        "humidity_rainfall": round(float(corr_df.loc['humidity', 'rainfall']), 3) if not np.isnan(corr_df.loc['humidity', 'rainfall']) else 0
    }

    # 3. Location breakdown
    location_groups = df.groupby('location')
    loc_stats = []
    for loc, group in location_groups:
        loc_stats.append({
            "location": loc,
            "record_count": int(group['record_id'].count()),
            "avg_temperature": round(float(group['temperature'].mean()), 2) if not group['temperature'].dropna().empty else None,
            "min_temperature": round(float(group['temperature'].min()), 2) if not group['temperature'].dropna().empty else None,
            "max_temperature": round(float(group['temperature'].max()), 2) if not group['temperature'].dropna().empty else None,
            "avg_humidity": round(float(group['humidity'].mean()), 2) if not group['humidity'].dropna().empty else None,
            "total_rainfall": round(float(group['rainfall'].sum()), 2) if not group['rainfall'].dropna().empty else 0,
            "max_rainfall": round(float(group['rainfall'].max()), 2) if not group['rainfall'].dropna().empty else 0
        })

    # 4. Historical Anomaly Detection (Z-score > 2.5 per variable)
    anomalies = []
    for col in ['temperature', 'rainfall']:
        valid_series = df[col].dropna()
        if len(valid_series) > 10 and valid_series.std() > 0:
            mean = valid_series.mean()
            std = valid_series.std()
            z_scores = (df[col] - mean) / std
            outliers = df[z_scores.abs() > 2.5]
            for _, r in outliers.head(10).iterrows():
                anomalies.append({
                    "record_id": int(r['record_id']),
                    "date": r['observation_date'].strftime('%Y-%m-%d'),
                    "location": r['location'],
                    "variable": col,
                    "value": round(float(r[col]), 2),
                    "mean": round(float(mean), 2),
                    "deviation_sigma": round(float(z_scores.loc[r.name]), 2),
                    "type": "Extreme High" if z_scores.loc[r.name] > 0 else "Extreme Low"
                })

    # 5. Publication-Quality Matplotlib Visualizations
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    chart_files = []

    # Chart 1: Temperature Distribution Histogram with KDE
    fig, ax = plt.subplots(figsize=(8, 4.8), dpi=150)
    temp_clean = df['temperature'].dropna()
    if not temp_clean.empty:
        n, bins, patches = ax.hist(temp_clean, bins=25, color='#3b82f6', edgecolor='#1e40af', alpha=0.75, density=True)
        # Overlay mean and median lines
        ax.axvline(temp_clean.mean(), color='#ef4444', linestyle='dashed', linewidth=2, label=f"Mean: {temp_clean.mean():.1f}°C")
        ax.axvline(temp_clean.median(), color='#10b981', linestyle='solid', linewidth=2, label=f"Median: {temp_clean.median():.1f}°C")
        ax.set_title('Historical Temperature Distribution', fontsize=13, fontweight='bold', pad=12)
        ax.set_xlabel('Temperature (°C)', fontsize=11)
        ax.set_ylabel('Probability Density', fontsize=11)
        ax.legend(frameon=True, facecolor='white', framealpha=0.9)
    plt.tight_layout()
    chart1_path = os.path.join(output_dir, 'temperature_distribution.png')
    fig.savefig(chart1_path)
    plt.close(fig)
    chart_files.append('temperature_distribution.png')

    # Chart 2: Monthly Temperature Variation Boxplot
    fig, ax = plt.subplots(figsize=(9, 4.8), dpi=150)
    month_order = sorted(df['month_num'].unique())
    box_data = [df[df['month_num'] == m]['temperature'].dropna() for m in month_order]
    month_labels = [df[df['month_num'] == m]['month'].iloc[0] for m in month_order]
    
    if any(len(b) > 0 for b in box_data):
        bp = ax.boxplot(box_data, patch_artist=True, tick_labels=month_labels,
                        medianprops=dict(color='#dc2626', linewidth=2),
                        boxprops=dict(facecolor='#93c5fd', color='#1d4ed8'))
        ax.set_title('Monthly Historical Temperature Variations (Boxplot)', fontsize=13, fontweight='bold', pad=12)
        ax.set_xlabel('Month', fontsize=11)
        ax.set_ylabel('Temperature (°C)', fontsize=11)
    plt.tight_layout()
    chart2_path = os.path.join(output_dir, 'monthly_temperature_boxplot.png')
    fig.savefig(chart2_path)
    plt.close(fig)
    chart_files.append('monthly_temperature_boxplot.png')

    # Chart 3: Humidity vs Rainfall Correlation Scatter
    fig, ax = plt.subplots(figsize=(8, 4.8), dpi=150)
    scatter_df = df.dropna(subset=['humidity', 'rainfall'])
    if not scatter_df.empty:
        scatter = ax.scatter(scatter_df['humidity'], scatter_df['rainfall'], 
                             c=scatter_df['temperature'], cmap='coolwarm', 
                             alpha=0.7, edgecolors='none', s=45)
        cbar = plt.colorbar(scatter, ax=ax)
        cbar.set_label('Temperature (°C)', fontsize=10)
        ax.set_title('Humidity vs. Rainfall Correlation (Colormap = Temp)', fontsize=13, fontweight='bold', pad=12)
        ax.set_xlabel('Relative Humidity (%)', fontsize=11)
        ax.set_ylabel('Rainfall (mm)', fontsize=11)
    plt.tight_layout()
    chart3_path = os.path.join(output_dir, 'humidity_rainfall_scatter.png')
    fig.savefig(chart3_path)
    plt.close(fig)
    chart_files.append('humidity_rainfall_scatter.png')

    # Chart 4: Location Comparison (Mean Temp & Total Rain)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.8), dpi=150)
    loc_names = [s['location'] for s in loc_stats]
    loc_temps = [s['avg_temperature'] or 0 for s in loc_stats]
    loc_rains = [s['total_rainfall'] for s in loc_stats]

    ax1.barh(loc_names, loc_temps, color='#0284c7', edgecolor='#0369a1')
    ax1.set_title('Average Temperature by Location', fontsize=11, fontweight='bold')
    ax1.set_xlabel('Mean Temp (°C)', fontsize=10)

    ax2.barh(loc_names, loc_rains, color='#059669', edgecolor='#047857')
    ax2.set_title('Cumulative Precipitation by Location', fontsize=11, fontweight='bold')
    ax2.set_xlabel('Total Rainfall (mm)', fontsize=10)

    plt.tight_layout()
    chart4_path = os.path.join(output_dir, 'location_comparison.png')
    fig.savefig(chart4_path)
    plt.close(fig)
    chart_files.append('location_comparison.png')

    result = {
        "status": "success",
        "total_records": len(df),
        "date_range": {
            "start": df['observation_date'].min().strftime('%Y-%m-%d'),
            "end": df['observation_date'].max().strftime('%Y-%m-%d')
        },
        "descriptive_statistics": desc_stats,
        "correlations": correlations,
        "location_summary": loc_stats,
        "historical_anomalies": anomalies,
        "charts": chart_files
    }

    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    analyze()
