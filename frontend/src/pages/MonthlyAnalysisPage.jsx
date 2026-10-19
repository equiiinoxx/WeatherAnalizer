import React, { useState, useEffect } from 'react';
import { getLatestAnalysis, runPythonAnalysis } from '../services/api';

export default function MonthlyAnalysisPage() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMonthlyAnalysis();
  }, []);

  const loadMonthlyAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLatestAnalysis();
      setAnalysis(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load monthly analysis data');
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = async () => {
    setExecuting(true);
    setError(null);
    try {
      const res = await runPythonAnalysis();
      setAnalysis(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to execute Python analysis');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loader py-5">
        <div className="spinner"></div>
        <p>Analyzing historical monthly observations with Pandas & NumPy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
        <button className="btn btn-sm btn-secondary ml-3" onClick={loadMonthlyAnalysis}>
          Retry
        </button>
      </div>
    );
  }

  const monthlyList = analysis?.monthly_aggregations || [];
  const tempComparison = analysis?.monthly_temperature_comparison || {};
  const allMonths = Object.keys(tempComparison);

  // Extract unique locations from comparison data
  const allLocations = [];
  allMonths.forEach(m => {
    Object.keys(tempComparison[m] || {}).forEach(loc => {
      if (!allLocations.includes(loc)) allLocations.push(loc);
    });
  });
  allLocations.sort();

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Monthly Climate & Precipitation Analysis</h1>
          <p className="page-subtitle">
            Seasonal temperature envelopes, cumulative monthly rainfall totals, and cross-station temperature comparisons.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRerun}
          disabled={executing}
        >
          {executing ? '⚙️ Computing Statistics...' : '⚡ Recompute Python Analytics'}
        </button>
      </div>

      {/* Monthly Aggregations Table Card */}
      <div className="card mb-4">
        <div className="card-header">
          <h3>🗓️ Monthly Meteorological Aggregations & Cumulative Rainfall</h3>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Observation Count</th>
                  <th>Mean Temp (°C)</th>
                  <th>Min Temp (°C)</th>
                  <th>Max Temp (°C)</th>
                  <th>Mean Humidity (%)</th>
                  <th>Total Rainfall (mm)</th>
                  <th>Max Single Day (mm)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyList.map((m) => (
                  <tr key={m.period}>
                    <td><strong>{m.period}</strong></td>
                    <td>{m.record_count}</td>
                    <td>
                      <strong className="text-orange">{m.avg_temperature !== null ? `${m.avg_temperature} °C` : '—'}</strong>
                    </td>
                    <td>{m.min_temperature !== null ? `${m.min_temperature} °C` : '—'}</td>
                    <td>{m.max_temperature !== null ? `${m.max_temperature} °C` : '—'}</td>
                    <td>
                      <span className="text-teal">{m.avg_humidity !== null ? `${m.avg_humidity} %` : '—'}</span>
                    </td>
                    <td>
                      <span className="badge badge-primary font-bold">{m.total_rainfall} mm</span>
                    </td>
                    <td>{m.max_single_day_rainfall} mm</td>
                  </tr>
                ))}
                {monthlyList.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No monthly observation data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cross-Station Monthly Temperature Comparison Matrix */}
      {allMonths.length > 0 && allLocations.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h3>📍 Monthly Average Temperature Comparison Across Stations (°C)</h3>
            <span className="text-muted font-sm">
              Cross-station comparison of mean observed temperature by calendar month
            </span>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="data-table comparison-matrix-table">
                <thead>
                  <tr>
                    <th>Station / Location</th>
                    {allMonths.map((m) => (
                      <th key={m} className="text-center">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLocations.map((loc) => (
                    <tr key={loc}>
                      <td><strong>{loc}</strong></td>
                      {allMonths.map((m) => {
                        const tempVal = tempComparison[m]?.[loc];
                        return (
                          <td key={m} className="text-center">
                            {tempVal !== undefined ? (
                              <span className={`matrix-val ${tempVal > 30 ? 'text-danger' : tempVal < 15 ? 'text-info' : 'text-primary'}`}>
                                {tempVal} °C
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Overall Summary Statistics (Min, Max, Mean) */}
      {analysis?.descriptive_statistics && (
        <div className="card mb-4">
          <div className="card-header">
            <h3>📊 Overall Summary Statistics (Calculated via Pandas & NumPy)</h3>
            <span className="text-muted font-sm">
              Minimum, maximum, and average values computed across all historical observations
            </span>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Measurement Variable</th>
                    <th>Recorded Observations</th>
                    <th>Minimum</th>
                    <th>Average (Mean)</th>
                    <th>Maximum</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analysis.descriptive_statistics).map(([col, s]) => (
                    <tr key={col}>
                      <td className="text-capitalize">
                        <strong>
                          {col === 'temperature' ? '🌡️ Temperature (°C)' :
                           col === 'humidity' ? '💧 Relative Humidity (%)' : '🌧️ Rainfall (mm)'}
                        </strong>
                      </td>
                      <td>{s.count?.toLocaleString()}</td>
                      <td>
                        <strong>
                          {s.min !== null ? `${s.min} ${col === 'temperature' ? '°C' : col === 'humidity' ? '%' : 'mm'}` : '—'}
                        </strong>
                      </td>
                      <td>
                        <span className="badge badge-info font-bold">
                          {s.mean !== null ? `${s.mean} ${col === 'temperature' ? '°C' : col === 'humidity' ? '%' : 'mm'}` : '—'}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {s.max !== null ? `${s.max} ${col === 'temperature' ? '°C' : col === 'humidity' ? '%' : 'mm'}` : '—'}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
