import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSummary, getBatches } from '../services/api';

export default function OverviewPage() {
  const [summaryData, setSummaryData] = useState(null);
  const [recentBatches, setRecentBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, batchesRes] = await Promise.all([
        getSummary(),
        getBatches(5, 0)
      ]);
      setSummaryData(sumRes.data);
      setRecentBatches(batchesRes.data.batches || []);
    } catch (err) {
      setError(err.message || 'Failed to load system overview metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner"></div>
        <p>Loading historical climate metrics from MySQL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
        <button className="btn btn-sm btn-secondary" onClick={loadOverview}>
          Retry
        </button>
      </div>
    );
  }

  const { kpis, extremes, locationBreakdown } = summaryData || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Historical Climate Overview</h1>
          <p className="page-subtitle">
            Key meteorological metrics aggregated across all historical observations in MySQL.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadOverview}>
            🔄 Refresh Data
          </button>
          <Link to="/upload" className="btn btn-primary">
            📤 Ingest New CSV
          </Link>
        </div>
      </div>

      {/* Date Range Banner */}
      {kpis?.dateRange?.from && (
        <div className="info-banner mb-4">
          <span className="banner-icon">📅</span>
          <div>
            <strong>Historical Observation Span:</strong>{' '}
            <span className="badge badge-info">{kpis.dateRange.from}</span> to{' '}
            <span className="badge badge-info">{kpis.dateRange.to}</span>
            <span className="text-muted ml-3 font-sm">
              (Historical records only; predictive forecasting is disabled)
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid mb-4">
        {/* Total Accepted Records */}
        <div className="kpi-card card-blue">
          <div className="kpi-icon">📋</div>
          <div className="kpi-body">
            <span className="kpi-title">Total Accepted Records</span>
            <span className="kpi-metric">{kpis?.totalRecords?.toLocaleString() || 0}</span>
            <span className="kpi-sub">
              Observations stored in <code>weather_records</code>
            </span>
          </div>
        </div>

        {/* Monitoring Locations */}
        <div className="kpi-card card-teal">
          <div className="kpi-icon">📍</div>
          <div className="kpi-body">
            <span className="kpi-title">Active Stations</span>
            <span className="kpi-metric">{kpis?.uniqueLocations || 0}</span>
            <span className="kpi-sub">
              Monitored geographical locations
            </span>
          </div>
        </div>

        {/* Average Temperature */}
        <div className="kpi-card card-orange">
          <div className="kpi-icon">🌡️</div>
          <div className="kpi-body">
            <span className="kpi-title">Average Temperature</span>
            <span className="kpi-metric">
              {kpis?.temperature?.avg !== null ? `${kpis.temperature.avg} °C` : '—'}
            </span>
            <span className="kpi-sub">
              Min: {kpis?.temperature?.min ?? '—'} °C | Max: {kpis?.temperature?.max ?? '—'} °C
            </span>
          </div>
        </div>

        {/* Average Relative Humidity */}
        <div className="kpi-card card-cyan">
          <div className="kpi-icon">💧</div>
          <div className="kpi-body">
            <span className="kpi-title">Average Relative Humidity</span>
            <span className="kpi-metric">
              {kpis?.humidity?.avg !== null ? `${kpis.humidity.avg} %` : '—'}
            </span>
            <span className="kpi-sub">
              Min: {kpis?.humidity?.min ?? '—'} % | Max: {kpis?.humidity?.max ?? '—'} %
            </span>
          </div>
        </div>

        {/* Total Cumulative Rainfall */}
        <div className="kpi-card card-indigo">
          <div className="kpi-icon">🌧️</div>
          <div className="kpi-body">
            <span className="kpi-title">Cumulative Precipitation</span>
            <span className="kpi-metric">
              {kpis?.rainfall?.total !== null ? `${kpis.rainfall.total} mm` : '0.00 mm'}
            </span>
            <span className="kpi-sub">
              Max single-day: {kpis?.rainfall?.max ?? '—'} mm
            </span>
          </div>
        </div>
      </div>

      {/* Historical Extremes Grid */}
      <div className="two-column-grid mb-4">
        {/* Heat Extremes */}
        <div className="card">
          <div className="card-header">
            <h3>🔥 Top 5 Historical Heat Extremes</h3>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Max Temp (°C)</th>
                </tr>
              </thead>
              <tbody>
                {extremes?.hottest?.map((r) => (
                  <tr key={r.record_id}>
                    <td>{r.observation_date}</td>
                    <td><strong>{r.location}</strong></td>
                    <td>
                      <span className="badge badge-danger font-bold">{r.temperature} °C</span>
                    </td>
                  </tr>
                ))}
                {(!extremes?.hottest || extremes.hottest.length === 0) && (
                  <tr>
                    <td colSpan="3" className="text-center text-muted">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Wettest Days */}
        <div className="card">
          <div className="card-header">
            <h3>⛈️ Top 5 Historical Precipitation Events</h3>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Rainfall (mm)</th>
                </tr>
              </thead>
              <tbody>
                {extremes?.wettest?.map((r) => (
                  <tr key={r.record_id}>
                    <td>{r.observation_date}</td>
                    <td><strong>{r.location}</strong></td>
                    <td>
                      <span className="badge badge-primary font-bold">{r.rainfall} mm</span>
                    </td>
                  </tr>
                ))}
                {(!extremes?.wettest || extremes.wettest.length === 0) && (
                  <tr>
                    <td colSpan="3" className="text-center text-muted">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Location Breakdown Table */}
      <div className="card mb-4">
        <div className="card-header flex-between">
          <h3>📍 Monitoring Locations Baseline Summary</h3>
          <Link to="/charts" className="btn btn-sm btn-outline">
            View Comparative Visualizations →
          </Link>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Station / City</th>
                  <th>Recorded Observations</th>
                  <th>Mean Temperature (°C)</th>
                  <th>Mean Humidity (%)</th>
                  <th>Total Precipitation (mm)</th>
                </tr>
              </thead>
              <tbody>
                {locationBreakdown?.map((loc) => (
                  <tr key={loc.location}>
                    <td><strong>{loc.location}</strong></td>
                    <td>{loc.record_count?.toLocaleString()}</td>
                    <td>{loc.avg_temp !== null ? `${loc.avg_temp} °C` : '—'}</td>
                    <td>{loc.avg_humidity !== null ? `${loc.avg_humidity} %` : '—'}</td>
                    <td>
                      <span className="badge badge-info">{loc.total_rain} mm</span>
                    </td>
                  </tr>
                ))}
                {(!locationBreakdown || locationBreakdown.length === 0) && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-4">
                      No weather data available yet. Please use the CSV Upload page to ingest data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Ingestion Batches */}
      <div className="card">
        <div className="card-header flex-between">
          <h3>📦 Recent Import Batches</h3>
          <Link to="/data-quality" className="btn btn-sm btn-outline">
            Full Data Quality Log →
          </Link>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Filename</th>
                  <th>Total Rows</th>
                  <th>Accepted (Stored)</th>
                  <th>Rejected (Anomalies)</th>
                  <th>Import Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((b) => (
                  <tr key={b.batch_id}>
                    <td><strong>#{b.batch_id}</strong></td>
                    <td><code>{b.filename}</code></td>
                    <td>{b.total_rows}</td>
                    <td><span className="text-success font-bold">{b.accepted_rows}</span></td>
                    <td>
                      {b.rejected_rows > 0 ? (
                        <span className="badge badge-warning">{b.rejected_rows} rejected</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="text-muted">{new Date(b.imported_at).toLocaleString()}</td>
                  </tr>
                ))}
                {recentBatches.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">No batches imported yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
