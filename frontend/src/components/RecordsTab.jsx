import React, { useState, useEffect } from 'react';
import { getRecords, getLocations, getExportUrl } from '../services/api';

export default function RecordsTab() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    location: 'ALL',
    startDate: '',
    endDate: '',
    minTemp: '',
    maxTemp: '',
    search: '',
    sortBy: 'observation_date',
    sortOrder: 'DESC',
    page: 1,
    limit: 25,
  });

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [filters]);

  const loadLocations = async () => {
    try {
      const res = await getLocations();
      setLocations(res.data || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters };
      if (params.location === 'ALL') delete params.location;
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;
      if (!params.minTemp) delete params.minTemp;
      if (!params.maxTemp) delete params.maxTemp;
      if (!params.search) delete params.search;

      const res = await getRecords(params);
      setRecords(res.data.records || []);
      setPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, val) => {
    setFilters((prev) => ({
      ...prev,
      [key]: val,
      page: 1, // reset to page 1 on filter change
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      location: 'ALL',
      startDate: '',
      endDate: '',
      minTemp: '',
      maxTemp: '',
      search: '',
      sortBy: 'observation_date',
      sortOrder: 'DESC',
      page: 1,
      limit: 25,
    });
  };

  const handleExport = () => {
    const exportParams = { ...filters };
    if (exportParams.location === 'ALL') delete exportParams.location;
    delete exportParams.page;
    delete exportParams.limit;
    window.open(getExportUrl(exportParams), '_blank');
  };

  return (
    <div className="tab-pane">
      <div className="pane-header flex-between">
        <div>
          <h2>Historical Weather Observations Explorer</h2>
          <p className="text-muted">
            Search, filter, paginate, and export historical observations from the MySQL <code>weather_records</code> table.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          📥 Export Filtered Data (CSV)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card mb-4 filter-bar">
        <div className="filter-grid">
          <div className="form-group">
            <label>Location / City</label>
            <select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="form-control"
            >
              <option value="ALL">All Locations ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>From Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>To Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Min Temp (°C)</label>
            <input
              type="number"
              placeholder="e.g. 15"
              value={filters.minTemp}
              onChange={(e) => handleFilterChange('minTemp', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Max Temp (°C)</label>
            <input
              type="number"
              placeholder="e.g. 40"
              value={filters.maxTemp}
              onChange={(e) => handleFilterChange('maxTemp', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Sort By</label>
            <div className="flex-row">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="form-control"
              >
                <option value="observation_date">Date</option>
                <option value="location">Location</option>
                <option value="temperature">Temperature</option>
                <option value="humidity">Humidity</option>
                <option value="rainfall">Rainfall</option>
              </select>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="form-control sort-order-select"
              >
                <option value="DESC">Desc ↓</option>
                <option value="ASC">Asc ↑</option>
              </select>
            </div>
          </div>
        </div>

        <div className="filter-actions mt-3 flex-between">
          <span className="text-muted">
            Found <strong>{pagination.total?.toLocaleString() || 0}</strong> observations matching current filter
          </span>
          <button className="btn btn-sm btn-secondary" onClick={handleResetFilters}>
            ✕ Clear Filters
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="loader">Querying weather observations...</div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Observation Date</th>
                    <th>Location</th>
                    <th>Temperature (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Rainfall (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.record_id}>
                      <td>#{r.record_id}</td>
                      <td>{r.observation_date}</td>
                      <td><strong>{r.location}</strong></td>
                      <td>
                        {r.temperature !== null ? (
                          <span className={`temp-val ${Number(r.temperature) > 35 ? 'text-danger' : Number(r.temperature) < 15 ? 'text-info' : ''}`}>
                            {Number(r.temperature).toFixed(2)} °C
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.humidity !== null ? `${Number(r.humidity).toFixed(1)} %` : '—'}
                      </td>
                      <td>
                        {r.rainfall !== null && Number(r.rainfall) > 0 ? (
                          <span className="badge badge-primary">{Number(r.rainfall).toFixed(2)} mm</span>
                        ) : (
                          <span className="text-muted">0.00 mm</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted">
                        No weather records match your active search or filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="pagination-bar flex-between mt-4">
              <span className="text-muted">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
              </span>
              <div className="pagination-buttons">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={!pagination.hasPrev}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
                >
                  ← Previous
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={!pagination.hasNext}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
