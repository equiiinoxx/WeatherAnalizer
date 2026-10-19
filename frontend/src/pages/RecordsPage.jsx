import React, { useState, useEffect } from 'react';
import { getRecords, getLocations, getExportUrl } from '../services/api';

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    limit: 25
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
      setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to fetch weather observations');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // reset to first page on filter change
    }));
  };

  const handleClearFilters = () => {
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
      limit: 25
    });
  };

  const handleExportCsv = () => {
    const exportParams = { ...filters };
    if (exportParams.location === 'ALL') delete exportParams.location;
    delete exportParams.page;
    delete exportParams.limit;
    window.open(getExportUrl(exportParams), '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Historical Weather Observations</h1>
          <p className="page-subtitle">
            Explore, filter, and audit verified historical observations from MySQL <code>weather_records</code>.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCsv}>
          📥 Export Filtered Records (CSV)
        </button>
      </div>

      {/* Filter Control Toolbar */}
      <div className="card mb-4 filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="filterLocation">Location / Station</label>
            <select
              id="filterLocation"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="form-control"
            >
              <option value="ALL">All Stations ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filterStartDate">From Observation Date</label>
            <input
              type="date"
              id="filterStartDate"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="filterEndDate">To Observation Date</label>
            <input
              type="date"
              id="filterEndDate"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="filterMinTemp">Min Temp (°C)</label>
            <input
              type="number"
              id="filterMinTemp"
              placeholder="e.g. 10"
              value={filters.minTemp}
              onChange={(e) => handleFilterChange('minTemp', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="filterMaxTemp">Max Temp (°C)</label>
            <input
              type="number"
              id="filterMaxTemp"
              placeholder="e.g. 42"
              value={filters.maxTemp}
              onChange={(e) => handleFilterChange('maxTemp', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="filterSortBy">Sort Observations By</label>
            <div className="flex-row">
              <select
                id="filterSortBy"
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
                aria-label="Sort direction"
              >
                <option value="DESC">Desc ↓</option>
                <option value="ASC">Asc ↑</option>
              </select>
            </div>
          </div>
        </div>

        <div className="filter-footer flex-between mt-3">
          <span className="text-secondary font-sm">
            Showing matching observations: <strong>{pagination.total?.toLocaleString() || 0}</strong> records found
          </span>
          <button className="btn btn-sm btn-secondary" onClick={handleClearFilters}>
            ✕ Reset Filters
          </button>
        </div>
      </div>

      {/* Records Table Card */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="page-loader py-5">
              <div className="spinner"></div>
              <p>Fetching observations...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Observation Date</th>
                    <th>Location / Station</th>
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
                        ) : (
                          <span className="text-muted" title="Missing measurement in record">NULL</span>
                        )}
                      </td>
                      <td>
                        {r.humidity !== null ? (
                          `${Number(r.humidity).toFixed(1)} %`
                        ) : (
                          <span className="text-muted" title="Missing measurement in record">NULL</span>
                        )}
                      </td>
                      <td>
                        {r.rainfall !== null ? (
                          Number(r.rainfall) > 0 ? (
                            <span className="badge badge-primary">{Number(r.rainfall).toFixed(2)} mm</span>
                          ) : (
                            <span className="text-muted">0.00 mm</span>
                          )
                        ) : (
                          <span className="text-muted" title="Missing measurement in record">NULL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-5">
                        No weather records match your active search or filter parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && pagination.totalPages > 1 && (
            <div className="pagination-bar flex-between mt-4">
              <span className="text-secondary font-sm">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total?.toLocaleString()} total records)
              </span>
              <div className="pagination-buttons">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
                >
                  ← Previous
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
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
