"""
Weather Data Visualization Module
Generates publication-quality Matplotlib figures for historical weather observations.
Ensures non-interactive rendering ('Agg'), units, labels, titles, and legends.
"""

import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
import numpy as np

CHARTS_DIR = os.path.join(os.path.dirname(__file__), 'charts')

def ensure_charts_dir():
    os.makedirs(CHARTS_DIR, exist_ok=True)
    return CHARTS_DIR

def generate_all_charts(df, location_filter=None, output_dir=None):
    """
    Generates all requested historical observation charts from a cleaned DataFrame.
    Returns:
        dict: mapping of chart keys to generated file names.
    """
    if output_dir is None:
        output_dir = ensure_charts_dir()
    else:
        os.makedirs(output_dir, exist_ok=True)

    generated = {}

    if df is None or df.empty:
        sys.stderr.write("generate_all_charts: DataFrame is empty; generating placeholder/empty figures.\n")
        return generated

    # Ensure required columns & types
    df = df.copy()
    df['observation_date'] = pd.to_datetime(df['observation_date'])
    df['temperature'] = pd.to_numeric(df['temperature'], errors='coerce')
    df['humidity'] = pd.to_numeric(df['humidity'], errors='coerce')
    df['rainfall'] = pd.to_numeric(df['rainfall'], errors='coerce')

    # Date metadata
    min_date = df['observation_date'].min().strftime('%Y-%m-%d')
    max_date = df['observation_date'].max().strftime('%Y-%m-%d')
    df['month_period'] = df['observation_date'].dt.to_period('M')
    df['month_name'] = df['observation_date'].dt.strftime('%b %Y')
    df['cal_month'] = df['observation_date'].dt.strftime('%b')
    df['month_num'] = df['observation_date'].dt.month

    locations = sorted(df['location'].dropna().unique())
    loc_title = location_filter if location_filter and location_filter != 'ALL' else (
        locations[0] if len(locations) == 1 else f"All Stations ({len(locations)} locations)"
    )

    # Styling settings
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    plt.rcParams.update({
        'font.size': 10,
        'axes.titlesize': 12,
        'axes.titleweight': 'bold',
        'axes.labelsize': 11,
        'xtick.labelsize': 9,
        'ytick.labelsize': 9,
        'figure.autolayout': True
    })

    # -------------------------------------------------------------
    # 1. Temperature Trends (Daily / Monthly Min, Avg, Max)
    # -------------------------------------------------------------
    try:
        monthly_temp = df.groupby('month_period').agg(
            avg_temp=('temperature', 'mean'),
            min_temp=('temperature', 'min'),
            max_temp=('temperature', 'max'),
            label=('month_name', 'first')
        ).reset_index()

        fig, ax = plt.subplots(figsize=(9, 4.8), dpi=150)
        x_indices = np.arange(len(monthly_temp))
        x_labels = monthly_temp['label']

        ax.fill_between(
            x_indices,
            monthly_temp['min_temp'],
            monthly_temp['max_temp'],
            color='#fee2e2',
            alpha=0.6,
            label='Observed Range (Min–Max)'
        )
        ax.plot(x_indices, monthly_temp['max_temp'], color='#ef4444', linestyle='--', linewidth=1.5, label='Maximum Temp (°C)')
        ax.plot(x_indices, monthly_temp['avg_temp'], color='#ea580c', marker='o', linewidth=2.5, label='Mean Temp (°C)')
        ax.plot(x_indices, monthly_temp['min_temp'], color='#0284c7', linestyle='--', linewidth=1.5, label='Minimum Temp (°C)')

        ax.set_xticks(x_indices)
        ax.set_xticklabels(x_labels, rotation=35, ha='right')
        ax.set_title(f"Historical Temperature Trends & Variation Envelope ({loc_title})", pad=12)
        ax.set_xlabel("Observation Period")
        ax.set_ylabel("Temperature (°C)")
        ax.legend(loc='best', frameon=True, facecolor='white', framealpha=0.9)
        ax.text(0.01, -0.22, f"Span: {min_date} to {max_date} | Historical Observations Only", transform=ax.transAxes, fontsize=8, color='#64748b')

        out_path1 = os.path.join(output_dir, 'temperature_trends.png')
        fig.savefig(out_path1, bbox_inches='tight')
        plt.close(fig)
        generated['temperature_trends'] = 'temperature_trends.png'
    except Exception as ex:
        sys.stderr.write(f"Error generating temperature_trends.png: {str(ex)}\n")

    # -------------------------------------------------------------
    # 2. Monthly Rainfall Totals
    # -------------------------------------------------------------
    try:
        monthly_rain = df.groupby('month_period').agg(
            total_rainfall=('rainfall', 'sum'),
            label=('month_name', 'first')
        ).reset_index()

        fig, ax = plt.subplots(figsize=(9, 4.8), dpi=150)
        x_indices = np.arange(len(monthly_rain))
        bars = ax.bar(x_indices, monthly_rain['total_rainfall'], color='#0284c7', edgecolor='#0369a1', width=0.55, label='Cumulative Rainfall (mm)')

        # Annotate bar heights
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax.annotate(f"{height:.1f}",
                            xy=(bar.get_x() + bar.get_width() / 2, height),
                            xytext=(0, 3),
                            textcoords="offset points",
                            ha='center', va='bottom', fontsize=8.5, color='#0f172a', fontweight='bold')

        ax.set_xticks(x_indices)
        ax.set_xticklabels(monthly_rain['label'], rotation=35, ha='right')
        ax.set_title(f"Monthly Historical Precipitation Totals ({loc_title})", pad=12)
        ax.set_xlabel("Observation Period")
        ax.set_ylabel("Total Rainfall (mm)")
        ax.legend(loc='upper right', frameon=True, facecolor='white', framealpha=0.9)
        ax.text(0.01, -0.22, f"Cumulative historical rainfall | Units: Millimeters (mm)", transform=ax.transAxes, fontsize=8, color='#64748b')

        out_path2 = os.path.join(output_dir, 'monthly_rainfall.png')
        fig.savefig(out_path2, bbox_inches='tight')
        plt.close(fig)
        generated['monthly_rainfall'] = 'monthly_rainfall.png'
    except Exception as ex:
        sys.stderr.write(f"Error generating monthly_rainfall.png: {str(ex)}\n")

    # -------------------------------------------------------------
    # 3. Monthly Temperature Comparison (Across Locations)
    # -------------------------------------------------------------
    try:
        fig, ax = plt.subplots(figsize=(10, 5.0), dpi=150)
        loc_month = df.groupby(['cal_month', 'month_num', 'location'])['temperature'].mean().reset_index()
        loc_month = loc_month.sort_values('month_num')

        month_labels = loc_month[['month_num', 'cal_month']].drop_duplicates().sort_values('month_num')['cal_month'].tolist()
        x = np.arange(len(month_labels))
        distinct_locs = loc_month['location'].unique()

        if len(distinct_locs) > 1:
            total_locs = len(distinct_locs)
            bar_width = min(0.8 / total_locs, 0.25)
            colors = plt.cm.tab10(np.linspace(0, 1, total_locs))

            for i, loc in enumerate(distinct_locs):
                sub = loc_month[loc_month['location'] == loc]
                # align with full month labels
                y_vals = [sub[sub['cal_month'] == m]['temperature'].mean() if len(sub[sub['cal_month'] == m]) > 0 else np.nan for m in month_labels]
                offset = (i - total_locs / 2 + 0.5) * bar_width
                ax.bar(x + offset, y_vals, width=bar_width, label=loc, color=colors[i], edgecolor='white', linewidth=0.5)

            ax.set_xticks(x)
            ax.set_xticklabels(month_labels)
            ax.set_title("Comparative Monthly Average Temperatures Across Stations (°C)", pad=12)
            ax.set_xlabel("Calendar Month")
            ax.set_ylabel("Mean Observed Temperature (°C)")
            ax.legend(title="Monitoring Station", bbox_to_anchor=(1.02, 1), loc='upper left', frameon=True)
        else:
            # Single location fallback: Line/bar plot
            sub = loc_month[loc_month['location'] == distinct_locs[0]]
            ax.bar(sub['cal_month'], sub['temperature'], color='#f97316', edgecolor='#c2410c', width=0.5)
            ax.set_title(f"Monthly Average Temperature for {distinct_locs[0]} (°C)", pad=12)
            ax.set_xlabel("Calendar Month")
            ax.set_ylabel("Mean Temperature (°C)")

        out_path3 = os.path.join(output_dir, 'monthly_temperature_comparison.png')
        fig.savefig(out_path3, bbox_inches='tight')
        plt.close(fig)
        generated['monthly_temperature_comparison'] = 'monthly_temperature_comparison.png'
    except Exception as ex:
        sys.stderr.write(f"Error generating monthly_temperature_comparison.png: {str(ex)}\n")

    # -------------------------------------------------------------
    # 4. Humidity Trends
    # -------------------------------------------------------------
    try:
        monthly_hum = df.groupby('month_period').agg(
            avg_hum=('humidity', 'mean'),
            min_hum=('humidity', 'min'),
            max_hum=('humidity', 'max'),
            label=('month_name', 'first')
        ).reset_index()

        fig, ax = plt.subplots(figsize=(9, 4.8), dpi=150)
        x_indices = np.arange(len(monthly_hum))

        ax.fill_between(
            x_indices,
            monthly_hum['min_hum'],
            monthly_hum['max_hum'],
            color='#ccfbf1',
            alpha=0.6,
            label='Observed Humidity Envelope'
        )
        ax.plot(x_indices, monthly_hum['avg_hum'], color='#0d9488', marker='s', linewidth=2.5, label='Mean Relative Humidity (%)')
        ax.plot(x_indices, monthly_hum['max_hum'], color='#047857', linestyle=':', label='Max Humidity (%)')
        ax.plot(x_indices, monthly_hum['min_hum'], color='#14b8a6', linestyle=':', label='Min Humidity (%)')

        ax.set_xticks(x_indices)
        ax.set_xticklabels(monthly_hum['label'], rotation=35, ha='right')
        ax.set_ylim(0, 105)
        ax.set_title(f"Historical Relative Humidity Trends ({loc_title})", pad=12)
        ax.set_xlabel("Observation Period")
        ax.set_ylabel("Relative Humidity (%)")
        ax.legend(loc='lower right', frameon=True, facecolor='white', framealpha=0.9)
        ax.text(0.01, -0.22, f"Monitored Range: 0% to 100% | Span: {min_date} to {max_date}", transform=ax.transAxes, fontsize=8, color='#64748b')

        out_path4 = os.path.join(output_dir, 'humidity_trends.png')
        fig.savefig(out_path4, bbox_inches='tight')
        plt.close(fig)
        generated['humidity_trends'] = 'humidity_trends.png'
    except Exception as ex:
        sys.stderr.write(f"Error generating humidity_trends.png: {str(ex)}\n")

    return generated

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Generate Matplotlib charts for weather observations")
    parser.add_argument('--csv', help="Path to input CSV file")
    parser.add_argument('--out', help="Output directory for chart PNGs")
    args = parser.parse_args()

    if args.csv and os.path.exists(args.csv):
        df_input = pd.read_csv(args.csv)
        charts = generate_all_charts(df_input, output_dir=args.out)
        print(json.dumps({"status": "success", "charts": charts}, indent=2))
    else:
        sys.stderr.write("No CSV provided or file not found. Usage: python generate_charts.py --csv <path>\n")
        sys.exit(1)
