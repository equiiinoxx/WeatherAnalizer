import React, { useState, useEffect } from 'react';
import { getBatchIssues } from '../services/api';

export default function QualityIssuesModal({ batch, onClose }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!batch) return;
    loadIssues();
  }, [batch]);

  const loadIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBatchIssues(batch.batch_id, 200, 0);
      setIssues(res.data.issues || []);
    } catch (err) {
      setError(err.message || 'Failed to load data quality issues');
    } finally {
      setLoading(false);
    }
  };

  if (!batch) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Data Quality Anomaly Report</h3>
            <p className="modal-subtitle">
              Batch #{batch.batch_id} — <strong>{batch.filename}</strong> (
              <span className="text-danger">{batch.rejected_rows} rejected rows</span>)
            </p>
          </div>
          <button className="btn-close" onClick={onClose} title="Close Modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="loader">Loading anomalies and validation logs...</div>}
          {error && <div className="alert alert-error">{error}</div>}

          {!loading && !error && issues.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">✓</span>
              <p>No validation errors or anomalies recorded for this batch.</p>
            </div>
          )}

          {!loading && issues.length > 0 && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Issue ID</th>
                    <th>Source Row #</th>
                    <th>Field</th>
                    <th>Raw Value</th>
                    <th>Validation Anomaly Description</th>
                    <th>Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.issue_id}>
                      <td>#{issue.issue_id}</td>
                      <td>
                        <span className="badge badge-warning">Row {issue.source_row_number}</span>
                      </td>
                      <td>
                        <code>{issue.field_name}</code>
                      </td>
                      <td>
                        <code className="text-danger">
                          {issue.raw_value === null || issue.raw_value === '' ? 'NULL / Empty' : issue.raw_value}
                        </code>
                      </td>
                      <td className="desc-cell">{issue.issue_description}</td>
                      <td className="text-muted">
                        {new Date(issue.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="text-muted">
            Showing {issues.length} recorded anomalies from <code>data_quality_issues</code>
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
