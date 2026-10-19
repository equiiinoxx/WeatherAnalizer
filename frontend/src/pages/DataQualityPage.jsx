import React, { useState, useEffect } from 'react';
import { getAllQualityIssues, getBatches, getExportIssuesUrl } from '../services/api';
import QualityIssuesModal from '../components/QualityIssuesModal';

export default function DataQualityPage() {
  const [issues, setIssues] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedModalBatch, setSelectedModalBatch] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    loadQualityIssues();
  }, [selectedBatchId]);

  const loadBatches = async () => {
    try {
      const res = await getBatches(50, 0);
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const loadQualityIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const batchParam = selectedBatchId ? Number(selectedBatchId) : null;
      const res = await getAllQualityIssues(100, 0, batchParam);
      setIssues(res.data.issues || []);
      setPagination(res.data.pagination || { page: 1, limit: 100, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load quality issues log');
    } finally {
      setLoading(false);
    }
  };

  const handleExportIssues = () => {
    const url = getExportIssuesUrl(selectedBatchId ? Number(selectedBatchId) : null);
    window.open(url, '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Data Quality Assurance & Audit Ledger</h1>
          <p className="page-subtitle">
            Inspection ledger for anomalous, out-of-range, and duplicate observation records logged in <code>data_quality_issues</code>.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExportIssues}>
          📥 Export Quality Issues (CSV)
        </button>
      </div>

      {/* Filter by Batch Toolbar */}
      <div className="card mb-4 filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="issueBatchSelect">Filter by Ingestion Batch</label>
            <select
              id="issueBatchSelect"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="form-control"
            >
              <option value="">All Batches Combined</option>
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  Batch #{b.batch_id} — {b.filename} ({b.rejected_rows} anomalies)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-footer flex-between mt-3">
          <span className="text-secondary font-sm">
            Total Quality Issues Logged: <strong>{pagination.total?.toLocaleString() || 0}</strong> anomalies detected
          </span>
          {selectedBatchId && (
            <button className="btn btn-sm btn-secondary" onClick={() => setSelectedBatchId('')}>
              ✕ Show All Batches
            </button>
          )}
        </div>
      </div>

      {/* Issues Table Card */}
      <div className="card mb-4">
        <div className="card-header flex-between">
          <h3>🔍 Row-Level Validation Anomalies Ledger</h3>
          <span className="text-secondary font-sm">
            Uses exact <code>source_row_number</code> to trace back to source CSV
          </span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="page-loader py-5">
              <div className="spinner"></div>
              <p>Loading quality issues ledger...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Issue ID</th>
                    <th>Batch</th>
                    <th>Source Row #</th>
                    <th>Affected Field</th>
                    <th>Raw Offending Value</th>
                    <th>Anomaly Description</th>
                    <th>Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((i) => (
                    <tr key={i.issue_id}>
                      <td>#{i.issue_id}</td>
                      <td>
                        <span className="badge badge-neutral">Batch #{i.batch_id}</span>
                      </td>
                      <td>
                        <span className="badge badge-warning font-bold">
                          Row {i.source_row_number}
                        </span>
                      </td>
                      <td>
                        <code>{i.field_name}</code>
                      </td>
                      <td>
                        <code className="text-danger">
                          {i.raw_value === null || i.raw_value === '' ? 'NULL / Empty' : i.raw_value}
                        </code>
                      </td>
                      <td className="desc-cell">{i.issue_description}</td>
                      <td className="text-muted font-sm">
                        {new Date(i.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {issues.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-5">
                        ✓ No data quality issues recorded for the selected scope. All observations were valid!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import Batches History Table */}
      <div className="card">
        <div className="card-header flex-between">
          <h3>📦 Import Batches History</h3>
          <button className="btn btn-sm btn-secondary" onClick={loadBatches}>
            🔄 Refresh Batches
          </button>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Uploaded Filename</th>
                  <th>Total Rows</th>
                  <th>Accepted Rows</th>
                  <th>Rejected Rows</th>
                  <th>Import Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.batch_id}>
                    <td><strong>#{b.batch_id}</strong></td>
                    <td><code>{b.filename}</code></td>
                    <td>{b.total_rows}</td>
                    <td><span className="badge badge-success">{b.accepted_rows}</span></td>
                    <td>
                      {b.rejected_rows > 0 ? (
                        <span className="badge badge-warning">{b.rejected_rows} anomalies</span>
                      ) : (
                        <span className="badge badge-neutral">0</span>
                      )}
                    </td>
                    <td className="text-muted">{new Date(b.imported_at).toLocaleString()}</td>
                    <td>
                      <div className="flex-row">
                        {b.rejected_rows > 0 ? (
                          <>
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => setSelectedModalBatch(b)}
                            >
                              🔍 View Modal
                            </button>
                            <a
                              href={getExportIssuesUrl(b.batch_id)}
                              className="btn btn-sm btn-outline"
                              download
                              title="Export CSV of issues"
                            >
                              📥 CSV
                            </a>
                          </>
                        ) : (
                          <span className="text-muted font-sm">No issues</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for viewing quality issues */}
      {selectedModalBatch && (
        <QualityIssuesModal
          batch={selectedModalBatch}
          onClose={() => setSelectedModalBatch(null)}
        />
      )}
    </div>
  );
}
