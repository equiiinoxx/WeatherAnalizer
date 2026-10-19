import React, { useState, useEffect } from 'react';
import { uploadCsv, getBatches, getExportIssuesUrl } from '../services/api';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [recentBatches, setRecentBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await getBatches(15, 0);
      setRecentBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
      setErrorMessage(null);
      setUploadProgress(0);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);
    setUploadResult(null);

    try {
      const response = await uploadCsv(file, (progress) => {
        setUploadProgress(progress);
      });

      setUploadResult(response.data);
      setFile(null);
      const inputEl = document.getElementById('csvFileInput');
      if (inputEl) inputEl.value = '';

      loadBatches();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'File upload failed';
      setErrorMessage(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">CSV Ingestion & Quality Validation</h1>
          <p className="page-subtitle">
            Upload historical weather observations in CSV format. Flawed rows are diverted to the quality ledger without halting accepted rows.
          </p>
        </div>
      </div>

      {/* Upload Form Box */}
      <div className="card mb-4">
        <div className="card-header">
          <h3>📤 Select & Ingest Historical Weather CSV</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleUploadSubmit} className="upload-form">
            <div className="file-dropzone">
              <input
                type="file"
                id="csvFileInput"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <div className="dropzone-content">
                <span className="dropzone-icon">📁</span>
                <p className="dropzone-label">
                  {file ? (
                    <strong>{file.name} ({(file.size / 1024).toFixed(1)} KB)</strong>
                  ) : (
                    'Click to select or drag and drop a historical weather CSV file'
                  )}
                </p>
                <span className="dropzone-hint">
                  Required columns: <code>observation_date</code>, <code>location</code>, <code>temperature</code>, <code>humidity</code>, <code>rainfall</code>
                </span>
              </div>
            </div>

            {/* Live Upload Progress Bar */}
            {uploading && (
              <div className="progress-container mt-3">
                <div className="progress-header flex-between">
                  <span className="font-sm text-secondary">Uploading & processing CSV data...</span>
                  <span className="font-sm font-bold text-primary">{uploadProgress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="upload-actions mt-3 flex-between">
              <span className="text-muted font-sm">
                Maximum file size: 25 MB | Strictly historical observation records
              </span>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || uploading}
              >
                {uploading ? '⏳ Validating...' : '🚀 Upload & Process'}
              </button>
            </div>
          </form>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="alert alert-error mt-4">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Validation Results Card */}
          {uploadResult && (
            <div className="validation-result-card mt-4">
              <div className="result-header flex-between">
                <div>
                  <h4>Batch #{uploadResult.batchId} Processing Summary</h4>
                  <p className="text-secondary font-sm">File: <code>{uploadResult.filename}</code></p>
                </div>
                {uploadResult.rejectedRows > 0 && (
                  <a
                    href={getExportIssuesUrl(uploadResult.batchId)}
                    className="btn btn-sm btn-warning"
                    download
                  >
                    📥 Download Quality Issue Report (CSV)
                  </a>
                )}
              </div>

              <div className="result-metrics-grid mt-3">
                <div className="metric-box box-total">
                  <span className="box-val">{uploadResult.totalRows}</span>
                  <span className="box-lbl">Total Parsed</span>
                </div>
                <div className="metric-box box-accepted">
                  <span className="box-val text-success">{uploadResult.acceptedRows}</span>
                  <span className="box-lbl">Accepted (weather_records)</span>
                </div>
                <div className="metric-box box-rejected">
                  <span className="box-val text-danger">{uploadResult.rejectedRows}</span>
                  <span className="box-lbl">Rejected (data_quality_issues)</span>
                </div>
              </div>

              {uploadResult.breakdown && (
                <div className="breakdown-details mt-3">
                  <h5>Quality Breakdown:</h5>
                  <ul className="breakdown-list">
                    <li>
                      <strong>Duplicates Prevented:</strong> {uploadResult.breakdown.duplicatesDetected} rows
                      <span className="text-muted font-sm ml-2">(Preserves uniqueness of date/location)</span>
                    </li>
                    <li>
                      <strong>Missing Required Fields:</strong> {uploadResult.breakdown.missingRequiredFields} rows
                    </li>
                    <li>
                      <strong>Invalid / Out-of-Bounds:</strong> {uploadResult.breakdown.invalidOrOutOfBounds} rows
                    </li>
                    <li>
                      <strong>Missing Measurements Preserved as NULL:</strong> {uploadResult.breakdown.missingMeasurementsPreservedAsNull} instances
                      <span className="text-muted font-sm ml-2">(Never silently converted to zero)</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Validation Rules Card */}
      <div className="card mb-4 bg-surface-alt">
        <div className="card-header">
          <h4>🛡️ Active Validation & Quality Rules</h4>
        </div>
        <div className="card-body">
          <div className="rules-grid">
            <div className="rule-card">
              <strong>📅 Observation Date</strong>
              <p>Must be a valid date (YYYY-MM-DD). Future dates are rejected as this system stores historical observations only.</p>
            </div>
            <div className="rule-card">
              <strong>📍 Location Identifier</strong>
              <p>Required non-empty string, maximum 100 characters.</p>
            </div>
            <div className="rule-card">
              <strong>🌡️ Plausible Temperature</strong>
              <p>Valid range: <code>-60.0°C</code> to <code>+60.0°C</code>. Extreme physical anomalies rejected.</p>
            </div>
            <div className="rule-card">
              <strong>💧 Relative Humidity</strong>
              <p>Valid range: <code>0.0%</code> to <code>100.0%</code>. Negative or values over 100% rejected.</p>
            </div>
            <div className="rule-card">
              <strong>🌧️ Precipitation / Rainfall</strong>
              <p>Non-negative numeric value (<code>&gt;= 0 mm</code> and <code>&lt;= 1500 mm</code>). Negative values rejected.</p>
            </div>
            <div className="rule-card">
              <strong>🔒 Duplicate Protection</strong>
              <p>Exact date & location pairs already existing in MySQL or earlier rows are rejected to guarantee integrity.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Batches History Table */}
      <div className="card">
        <div className="card-header flex-between">
          <h3>📦 Ingestion History Batches</h3>
          <button className="btn btn-sm btn-secondary" onClick={loadBatches}>
            🔄 Refresh Batches
          </button>
        </div>
        <div className="card-body">
          {loadingBatches ? (
            <div className="page-loader py-4">
              <div className="spinner"></div>
              <p>Loading import batches...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Uploaded Filename</th>
                    <th>Total Rows</th>
                    <th>Accepted (Stored)</th>
                    <th>Rejected (Anomalies)</th>
                    <th>Import Timestamp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBatches.map((b) => (
                    <tr key={b.batch_id}>
                      <td><strong>#{b.batch_id}</strong></td>
                      <td><code>{b.filename}</code></td>
                      <td>{b.total_rows}</td>
                      <td><span className="badge badge-success">{b.accepted_rows}</span></td>
                      <td>
                        {b.rejected_rows > 0 ? (
                          <span className="badge badge-warning">{b.rejected_rows} anomalies</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td className="text-muted">{new Date(b.imported_at).toLocaleString()}</td>
                      <td>
                        {b.rejected_rows > 0 ? (
                          <a
                            href={getExportIssuesUrl(b.batch_id)}
                            className="btn btn-sm btn-warning"
                            title="Download CSV issue report"
                            download
                          >
                            📥 Download Issues CSV
                          </a>
                        ) : (
                          <span className="badge badge-neutral">Clean Batch</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {recentBatches.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        No import batches found. Upload a CSV file above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
