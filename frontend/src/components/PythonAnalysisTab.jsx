import React, { useState, useEffect } from 'react';
import { runPythonAnalysis, getLatestAnalysis } from '../services/api';

export default function PythonAnalysisTab() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLatestAnalysis();
      setAnalysis(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch statistical analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    setExecuting(true);
    setError(null);
    try {
      const res = await runPythonAnalysis();
      setAnalysis(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Analysis execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="tab-pane">
      <div className="pane-header flex-between">
        <div>
          <h2>Python Statistical Analytics & Anomaly Detection</h2>
          <p className="text-muted">
            Engineered with Python, Pandas, NumPy, and Matplotlib to analyze historical climate distributions and statistical correlations.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRunAnalysis}
          disabled={executing}
        >
          {executing ? '⚙️ Computing Statistics...' : '⚡ Run Python Engine'}
        </button>
      </div>

      {loading ? (
        <div className="loader">Loading statistical engine outputs...</div>
      ) : error ? (
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary ml-3" onClick={loadAnalysis}>
            Retry
          </button>
        </div>
      ) : !analysis || analysis.status === 'empty' ? (
        <div className="alert alert-warning">
          No records found in database to compute statistics. Please import CSV data first.
        </div>
      ) : (
        <div className="python-analysis-container">
          {/* Analysis Info Banner */}
          <div className="info-banner mb-4">
            <span>🔬 <strong>Sample Size:</strong> {analysis.total_records?.toLocaleString()} records</span>
            <span>📅 <strong>Observation Span:</strong> {analysis.date_range?.start} to {analysis.date_range?.end}</span>
            <span className="badge badge-success">Python 3.15 + NumPy + Pandas</span>
          </div>

          {/* Descriptive Statistics Table */}
          <div className="card mb-4">
            <div className="card-header">
              <h3>📐 Descriptive Parametric & Non-Parametric Statistics</h3>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th>Observations</th>
                      <th>Mean (μ)</th>
                      <th>Std Dev (σ)</th>
                      <th>Min</th>
                      <th>Q1 (25%)</th>
                      <th>Median (50%)</th>
                      <th>Q3 (75%)</th>
                      <th>Max</th>
                      <th>IQR</th>
                      <th>Skewness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysis.descriptive_statistics || {}).map(([varName, stats]) => (
                      <tr key={varName}>
                        <td>
                          <strong className="text-capitalize">
                            {varName === 'temperature' ? '🌡️ Temperature (°C)' :
                             varName === 'humidity' ? '💧 Humidity (%)' : '🌧️ Rainfall (mm)'}
                          </strong>
                        </td>
                        <td>{stats.count}</td>
                        <td><strong>{stats.mean}</strong></td>
                        <td>{stats.std}</td>
                        <td>{stats.min}</td>
                        <td>{stats.q25}</td>
                        <td><strong>{stats.median}</strong></td>
                        <td>{stats.q75}</td>
                        <td>{stats.max}</td>
                        <td>{stats.iqr}</td>
                        <td>
                          <span className={Math.abs(stats.skewness) > 1 ? 'text-warning' : ''}>
                            {stats.skewness}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Correlations & Anomaly Highlights */}
          <div className="two-col-grid mb-4">
            {/* Correlation Matrix */}
            <div className="card">
              <div className="card-header">
                <h3>🔗 Pearson Correlation Matrix</h3>
              </div>
              <div className="card-body">
                <div className="corr-grid">
                  <div className="corr-card">
                    <span className="corr-title">Temperature ⟷ Humidity</span>
                    <span className="corr-val text-primary">
                      {analysis.correlations?.temp_humidity ?? '—'}
                    </span>
                    <span className="corr-desc">
                      {Math.abs(analysis.correlations?.temp_humidity || 0) < 0.3
                        ? 'Weak correlation'
                        : analysis.correlations?.temp_humidity > 0
                        ? 'Moderate positive relationship'
                        : 'Moderate negative relationship'}
                    </span>
                  </div>

                  <div className="corr-card">
                    <span className="corr-title">Temperature ⟷ Rainfall</span>
                    <span className="corr-val text-orange">
                      {analysis.correlations?.temp_rainfall ?? '—'}
                    </span>
                    <span className="corr-desc">
                      {Math.abs(analysis.correlations?.temp_rainfall || 0) < 0.3
                        ? 'Weak correlation'
                        : 'Moderate relationship'}
                    </span>
                  </div>

                  <div className="corr-card">
                    <span className="corr-title">Humidity ⟷ Rainfall</span>
                    <span className="corr-val text-teal">
                      {analysis.correlations?.humidity_rainfall ?? '—'}
                    </span>
                    <span className="corr-desc">
                      {Math.abs(analysis.correlations?.humidity_rainfall || 0) < 0.3
                        ? 'Weak correlation'
                        : 'Moderate relationship'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Anomalies */}
            <div className="card">
              <div className="card-header">
                <h3>⚠️ Detected Historical Climate Anomalies (|Z| &gt; 2.5σ)</h3>
              </div>
              <div className="card-body">
                {(!analysis.historical_anomalies || analysis.historical_anomalies.length === 0) ? (
                  <div className="text-muted text-center py-4">
                    No extreme statistical outliers found beyond 2.5 standard deviations.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Location</th>
                          <th>Observed Value</th>
                          <th>Deviation (Z)</th>
                          <th>Anomaly Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.historical_anomalies.slice(0, 6).map((anom, idx) => (
                          <tr key={idx}>
                            <td>{anom.date}</td>
                            <td>{anom.location}</td>
                            <td>
                              <strong>
                                {anom.value} {anom.variable === 'temperature' ? '°C' : 'mm'}
                              </strong>
                            </td>
                            <td>
                              <span className="badge badge-warning">
                                {anom.deviation_sigma > 0 ? `+${anom.deviation_sigma}σ` : `${anom.deviation_sigma}σ`}
                              </span>
                            </td>
                            <td>
                              <span className={anom.type.includes('High') ? 'text-danger' : 'text-info'}>
                                {anom.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Publication-Grade Matplotlib Visualizations */}
          <div className="card">
            <div className="card-header">
              <h3>📊 Publication-Grade Matplotlib Visualizations</h3>
              <span className="text-muted font-sm">
                Generated server-side with Matplotlib from cleaned historical observations
              </span>
            </div>
            <div className="card-body">
              <div className="matplotlib-gallery">
                {analysis.charts?.map((chartFile) => (
                  <div key={chartFile} className="chart-figure-card">
                    <img
                      src={`/api/charts/${chartFile}?t=${Date.now()}`}
                      alt={chartFile}
                      className="figure-img"
                    />
                    <div className="figure-caption">
                      <code>{chartFile}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
