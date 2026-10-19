import React, { useState, useEffect } from 'react';
import { getSummary, getBatches } from '../services/api';

export default function OverviewTab({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [recentBatches, setRecentBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, batchesRes] = await Promise.all([
        getSummary(),
        getBatches(5, 0)
      ]);
      setData(summaryRes.data);
      setRecentBatches(batchesRes.data.batches || []);
    } catch (err) {
      setError(err.message || 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loader">Aggregating historical climate metrics...</div>;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
        <button className="btn btn-sm btn-secondary" onClick={loadOverviewData}>
          Retry
        </button>
      </div>
    );
  }

  const { kpis, extremes, locationBreakdown } = data || {};

  return (
    <div className="tab-pane">
      <div className="pane-header">
        <div>
          <h2>System Overview & Historical KPIs</h2>
          <p className="text-muted">
            High-level statistical summary across all historical weather observations stored in MySQL.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadOverviewData}>
          🔄 Refresh Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card card-blue">
          <div className="kpi-icon">📋</div>
          <div className="kpi-content">
            <span className="kpi-label">Total Observations</span>
            <span className="kpi-value">{kpis?.totalRecords?.toLocaleString() || 0}</span>
            <span className="kpi-sub">
              Across {kpis?.uniqueLocations || 0} monitoring locations
            </span>
          </div>
        </div>

        <div className="kpi-card card-orange">
          <div className="kpi-icon">🌡️</div>
          <div className="kpi-content">
            <span className="kpi-label">Historical Temp (Avg)</span>
            <span className="kpi-value">{kpis?.temperature?.avg ?? '—'} °C</span>
            <span className="kpi-sub">
              Min: {kpis?.temperature?.min ?? '—'}°C | Max: {kpis?.temperature?.max ?? '—'}°C
            </span>
          </div>
        </div>

        <div className="kpi-card card-teal">
          <div className="kpi-icon">💧</div>
          <div className="kpi-content">
            <span className="kpi-label">Relative Humidity (Avg)</span>
            <span className="kpi-value">{kpis?.humidity?.avg ?? '—'} %</span>
            <span className="kpi-sub">
              Range: {kpis?.humidity?.min ?? '—'}% — {kpis?.humidity?.max ?? '—'}%
            </span>
          </div>
        </div>

        <div className="kpi-card card-indigo">
          <div className="kpi-icon">🌧️</div>
          <div className="kpi-content">
            <span className="kpi-label">Cumulative Rainfall</span>
            <span className="kpi-value">{kpis?.rainfall?.total ?? 0} mm</span>
            <span className="kpi-sub">
              Max single day: {kpis?.rainfall?.max ?? 0} mm
            </span>
          </div>
        </div>
      </div>

      {/* Date Span Banner */}
      {kpis?.dateRange?.from && (
        <div className="info-banner">
          <span>📅 <strong>Historical Observation Span:</strong></span>
          <span className="badge badge-info">{kpis.dateRange.from}</span>
          <span>to</span>
          <span className="badge badge-info">{kpis.dateRange.to}</span>
          <span className="text-muted">(Forecasting disabled; observation analysis only)</span>
        </div>
      )}

      {/* Grid: Extremes & Recent Batches */}
      <div className="two-col-grid">
        {/* Extremes */}
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
                  <th>Temperature</th>
                </tr>
              </thead>
              <tbody>
                {extremes?.hottest?.map((r) => (
                  <tr key={r.record_id}>
                    <td>{r.observation_date}</td>
                    <td><strong>{r.location}</strong></td>
                    <td><span className="badge badge-danger">{r.temperature} °C</span></td>
                  </tr>
                ))}
                {(!extremes?.hottest || extremes.hottest.length === 0) && (
                  <tr><td colSpan="3" className="text-center text-muted">No records found</td></tr>
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
                    <td><span className="badge badge-primary">{r.rainfall} mm</span></td>
                  </tr>
                ))}
                {(!extremes?.wettest || extremes.wettest.length === 0) && (
                  <tr><td colSpan="3" className="text-center text-muted">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Regional / Location Breakdown */}
      <div className="card mt-4">
        <div className="card-header flex-between">
          <h3>📍 Monitoring Locations Summary Breakdown</h3>
          <button className="btn btn-sm btn-outline" onClick={() => onNavigateTab('visual')}>
            View Comparative Charts →
          </button>
        </div>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Location / Station</th>
                <th>Recorded Observations</th>
                <th>Avg Temperature</th>
                <th>Avg Humidity</th>
                <th>Cumulative Rainfall</th>
              </tr>
            </thead>
            <tbody>
              {locationBreakdown?.map((loc) => (
                <tr key={loc.location}>
                  <td><strong>{loc.location}</strong></td>
                  <td>{loc.record_count}</td>
                  <td>{loc.avg_temp ?? '—'} °C</td>
                  <td>{loc.avg_humidity ?? '—'} %</td>
                  <td>{loc.total_rain ?? 0} mm</td>
                </tr>
              ))}
              {(!locationBreakdown || locationBreakdown.length === 0) && (
                <tr>
                  <td colSpan="5" className="text-center text-muted">
                    No location records yet. Use the CSV Import tab to import historical datasets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Batches Quick Glance */}
      <div className="card mt-4">
        <div className="card-header flex-between">
          <h3>📦 Recent Import Batches</h3>
          <button className="btn btn-sm btn-outline" onClick={() => onNavigateTab('ingestion')}>
            Manage CSV Ingestion →
          </button>
        </div>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Filename</th>
                <th>Total Rows</th>
                <th>Accepted</th>
                <th>Rejected</th>
                <th>Import Date</th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.map((b) => (
                <tr key={b.batch_id}>
                  <td>#{b.batch_id}</td>
                  <td><code>{b.filename}</code></td>
                  <td>{b.total_rows}</td>
                  <td><span className="text-success font-bold">{b.accepted_rows}</span></td>
                  <td>
                    {b.rejected_rows > 0 ? (
                      <span className="badge badge-warning">{b.rejected_rows} anomalies</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td>{new Date(b.imported_at).toLocaleString()}</td>
                </tr>
              ))}
              {recentBatches.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted">No import batches found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
