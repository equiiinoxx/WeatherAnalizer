import React, { useState, useEffect } from 'react';
import { uploadCsv, getBatches } from '../services/api';
import QualityIssuesModal from './QualityIssuesModal';

export default function IngestionTab({ onDataImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedBatchForIssues, setSelectedBatchForIssues] = useState(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await getBatches(50, 0);
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadMessage(null);
      setUploadResult(null);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);
    setUploadResult(null);

    try {
      const res = await uploadCsv(file);
      setUploadResult(res.data);
      setUploadMessage({
        type: 'success',
        text: `Batch #${res.data.batchId} processed: ${res.data.acceptedRows} rows accepted into weather_records, ${res.data.rejectedRows} rejected to data_quality_issues.`
      });
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById('csvFileInput');
      if (fileInput) fileInput.value = '';

      loadBatches();
      if (onDataImported) onDataImported();
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'CSV upload failed'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="tab-pane">
      <div className="pane-header">
        <div>
          <h2>CSV Ingestion & Data Quality Assurance</h2>
          <p className="text-muted">
            Upload historical weather CSV observations. Valid records are stored in <code>weather_records</code>, while flawed or out-of-bounds rows are logged to <code>data_quality_issues</code>.
          </p>
        </div>
      </div>

      {/* Upload Box */}
      <div className="card mb-4">
        <div className="card-header">
          <h3>📤 Upload Historical Weather Observations CSV</h3>
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
                    'Click to select or drag and drop a historical weather .csv file'
                  )}
                </p>
                <span className="dropzone-hint">
                  Supports columns: <code>observation_date</code>, <code>location</code>, <code>temperature</code>, <code>humidity</code>, <code>rainfall</code>
                </span>
              </div>
            </div>

            <div className="upload-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || uploading}
              >
                {uploading ? '⏳ Validating & Ingesting...' : '🚀 Process & Ingest CSV'}
              </button>
            </div>
          </form>

          {/* Feedback messages */}
          {uploadMessage && (
            <div className={`alert alert-${uploadMessage.type} mt-3`}>
              <span>{uploadMessage.text}</span>
              {uploadResult?.rejectedRows > 0 && (
                <button
                  className="btn btn-sm btn-warning ml-3"
                  onClick={() => setSelectedBatchForIssues({
                    batch_id: uploadResult.batchId,
                    filename: uploadResult.filename,
                    rejected_rows: uploadResult.rejectedRows
                  })}
                >
                  Inspect {uploadResult.rejectedRows} Rejected Anomalies
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quality Rules Explanation Card */}
      <div className="card mb-4 bg-surface-alt">
        <div className="card-header">
          <h4>🛡️ Active Validation & Quality Rules</h4>
        </div>
        <div className="card-body rules-body">
          <div className="rule-item">
            <strong>📅 Observation Date:</strong>
            <span>Must be valid ISO/standard date format. Must NOT be in the future (strictly historical data).</span>
          </div>
          <div className="rule-item">
            <strong>📍 Location:</strong>
            <span>Required non-empty string, maximum 100 characters.</span>
          </div>
          <div className="rule-item">
            <strong>🌡️ Temperature:</strong>
            <span>Numeric value strictly between <code>-60°C</code> and <code>+60°C</code>. Outliers logged to quality issues.</span>
          </div>
          <div className="rule-item">
            <strong>💧 Humidity:</strong>
            <span>Relative humidity bounded between <code>0%</code> and <code>100%</code>.</span>
          </div>
          <div className="rule-item">
            <strong>🌧️ Rainfall:</strong>
            <span>Numeric non-negative value (<code>&gt;= 0 mm</code> and <code>&lt;= 1500 mm</code>). Negative values rejected.</span>
          </div>
          <div className="rule-item">
            <strong>🔍 Traceability:</strong>
            <span>Every rejection preserves the exact original <code>source_row_number</code>, field, and raw offending input.</span>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="card">
        <div className="card-header flex-between">
          <h3>📦 Historical Import Batches Log</h3>
          <button className="btn btn-sm btn-secondary" onClick={loadBatches}>
            🔄 Refresh Batches
          </button>
        </div>
        <div className="card-body">
          {loadingBatches ? (
            <div className="loader">Loading batches...</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Uploaded Filename</th>
                    <th>Total Rows</th>
                    <th>Accepted (Stored)</th>
                    <th>Rejected (Quality Issues)</th>
                    <th>Import Timestamp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.batch_id}>
                      <td><strong>#{b.batch_id}</strong></td>
                      <td><code>{b.filename}</code></td>
                      <td>{b.total_rows}</td>
                      <td>
                        <span className="badge badge-success">
                          {b.accepted_rows} rows
                        </span>
                      </td>
                      <td>
                        {b.rejected_rows > 0 ? (
                          <span className="badge badge-danger">
                            {b.rejected_rows} anomalies
                          </span>
                        ) : (
                          <span className="badge badge-neutral">0 issues</span>
                        )}
                      </td>
                      <td className="text-muted">
                        {new Date(b.imported_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${b.rejected_rows > 0 ? 'btn-warning' : 'btn-outline'}`}
                          onClick={() => setSelectedBatchForIssues(b)}
                        >
                          {b.rejected_rows > 0 ? '🔍 View Issues' : 'Audit Batch'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No CSV files have been imported yet. Use the upload area above to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal for viewing quality issues */}
      {selectedBatchForIssues && (
        <QualityIssuesModal
          batch={selectedBatchForIssues}
          onClose={() => setSelectedBatchForIssues(null)}
        />
      )}
    </div>
  );
}
