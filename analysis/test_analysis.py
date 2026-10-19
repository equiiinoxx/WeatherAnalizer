"""
Automated Test Suite for Python Weather Analysis Engine
Tests validate_data.py, analyze_weather.py, and generate_charts.py using sample CSVs and live database.
"""

import os
import sys
import json
import unittest
import pandas as pd
import numpy as np

# Adjust path to import from analysis directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, '..'))
sys.path.insert(0, CURRENT_DIR)

from validate_data import validate_dataframe, validate_csv_file
from analyze_weather import compute_analysis, fetch_data_from_db
from generate_charts import generate_all_charts, CHARTS_DIR

HISTORICAL_CSV = os.path.join(PROJECT_ROOT, 'sample_data', 'sample_weather_historical.csv')
ANOMALIES_CSV = os.path.join(PROJECT_ROOT, 'sample_data', 'sample_weather_with_anomalies.csv')

class TestWeatherValidation(unittest.TestCase):
    def test_clean_historical_csv_validation(self):
        """Clean sample CSV should be accepted with 0 rejected rows"""
        self.assertTrue(os.path.exists(HISTORICAL_CSV), f"Historical CSV must exist: {HISTORICAL_CSV}")
        report = validate_csv_file(HISTORICAL_CSV)
        self.assertTrue(report['is_valid'])
        self.assertGreater(report['total_rows'], 500)
        self.assertEqual(report['accepted_rows'], report['total_rows'])
        self.assertEqual(report['rejected_rows'], 0)
        self.assertEqual(len(report['issues']), 0)
        self.assertFalse(report['cleaned_df'].empty)

    def test_anomalies_csv_validation(self):
        """CSV with intentional errors should detect all 7 anomalies"""
        self.assertTrue(os.path.exists(ANOMALIES_CSV), f"Anomalies CSV must exist: {ANOMALIES_CSV}")
        report = validate_csv_file(ANOMALIES_CSV)
        self.assertFalse(report['is_valid'])
        self.assertEqual(report['total_rows'], 10)
        self.assertEqual(report['accepted_rows'], 3)
        self.assertEqual(report['rejected_rows'], 7)
        self.assertGreaterEqual(len(report['issues']), 7)

        # Verify specific detected anomaly descriptions
        issue_descriptions = [i['issue_description'] for i in report['issues']]
        issue_fields = [i['field_name'] for i in report['issues']]

        self.assertTrue(any('temperature' in f for f in issue_fields))
        self.assertTrue(any('humidity' in f for f in issue_fields))
        self.assertTrue(any('rainfall' in f for f in issue_fields))
        self.assertTrue(any('observation_date' in f for f in issue_fields))
        self.assertTrue(any('location' in f for f in issue_fields))

    def test_missing_required_headers(self):
        """CSV missing required columns should be rejected"""
        bad_df = pd.DataFrame({
            'date': ['2023-01-01'],
            'location': ['Delhi'],
            'temp': [25.0]
            # Missing rainfall, humidity
        })
        report = validate_dataframe(bad_df)
        self.assertFalse(report['is_valid'])
        self.assertEqual(report['accepted_rows'], 0)
        self.assertTrue('header' in report['issues'][0]['field_name'])


class TestWeatherAnalytics(unittest.TestCase):
    def setUp(self):
        self.df = pd.read_csv(HISTORICAL_CSV)

    def test_compute_analysis_metrics(self):
        """Check calculation of descriptive stats, daily/monthly aggregations, and correlations"""
        val = validate_dataframe(self.df)
        cleaned_df = val['cleaned_df']

        analysis = compute_analysis(cleaned_df, generate_plots=False)
        self.assertEqual(analysis['status'], 'success')
        self.assertEqual(analysis['total_records'], len(cleaned_df))

        # Check descriptive stats
        stats = analysis['descriptive_statistics']
        self.assertIn('temperature', stats)
        self.assertIn('humidity', stats)
        self.assertIn('rainfall', stats)

        temp_stats = stats['temperature']
        self.assertGreater(temp_stats['mean'], 0)
        self.assertGreater(temp_stats['max'], temp_stats['min'])
        self.assertEqual(temp_stats['median'], temp_stats['q50'] if 'q50' in temp_stats else temp_stats['median'])

        # Check monthly aggregations and rainfall totals
        monthly = analysis['monthly_aggregations']
        self.assertGreater(len(monthly), 0)
        for m in monthly:
            self.assertIn('total_rainfall', m)
            self.assertIn('avg_temperature', m)
            self.assertGreaterEqual(m['total_rainfall'], 0)

        # Check monthly temperature comparison across stations
        comp = analysis['monthly_temperature_comparison']
        self.assertGreater(len(comp), 0)
        first_month = list(comp.keys())[0]
        self.assertGreater(len(comp[first_month]), 1)

        # Check Pearson correlations
        corrs = analysis['correlations']
        self.assertIn('temp_humidity', corrs)
        self.assertIn('temp_rainfall', corrs)
        self.assertIn('humidity_rainfall', corrs)
        self.assertTrue(-1.0 <= corrs['temp_humidity'] <= 1.0)

    def test_empty_dataset_handling(self):
        """Empty DataFrame should not throw an exception and return empty status"""
        empty_df = pd.DataFrame()
        res = compute_analysis(empty_df, generate_plots=False)
        self.assertEqual(res['status'], 'empty')
        self.assertEqual(res['total_records'], 0)


class TestChartGeneration(unittest.TestCase):
    def setUp(self):
        self.df = pd.read_csv(HISTORICAL_CSV)

    def test_generate_all_requested_charts(self):
        """All 4 required charts must be generated with non-zero file sizes"""
        val = validate_dataframe(self.df)
        cleaned_df = val['cleaned_df']

        charts = generate_all_charts(cleaned_df)
        required_keys = [
            'temperature_trends',
            'monthly_rainfall',
            'monthly_temperature_comparison',
            'humidity_trends'
        ]

        for k in required_keys:
            self.assertIn(k, charts, f"Missing chart key: {k}")
            filename = charts[k]
            filepath = os.path.join(CHARTS_DIR, filename)
            self.assertTrue(os.path.exists(filepath), f"Chart file must exist on disk: {filepath}")
            file_size = os.path.getsize(filepath)
            self.assertGreater(file_size, 5000, f"Chart file {filename} too small: {file_size} bytes")


class TestDatabaseIntegration(unittest.TestCase):
    def test_database_fetch_and_analysis(self):
        """Verify fetching live observations from MySQL and running analysis"""
        try:
            df = fetch_data_from_db()
            self.assertFalse(df.empty, "Database table weather_records should contain data")
            analysis = compute_analysis(df, generate_plots=True)
            self.assertEqual(analysis['status'], 'success')
            self.assertGreater(analysis['total_records'], 0)
            self.assertGreater(len(analysis['charts']), 0)
        except Exception as e:
            self.fail(f"Database query and analysis raised exception: {e}")


if __name__ == '__main__':
    print("=" * 60)
    print("  Weather Data Analysis System — Python Engine Test Suite")
    print("=" * 60)
    unittest.main(verbosity=2)
