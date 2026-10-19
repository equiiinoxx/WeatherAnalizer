import React, { useState, useEffect } from 'react';
import { getDailySummaries, getLocations, getExportDailyUrl } from '../services/api';

export default function DailySummaryPage() {
  const [dailyData, setDailyData] = useState([]);
  const [locations, setLocations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    location: 'ALL',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 25
  });

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadDailyData();
  }, [filters]);

  const loadLocations = async () => {
    try {
      const res = await getLocations();
      setLocations(res.data || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadDailyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters };
      if (params.location === 'ALL') delete params.location;
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;

      const res = await getDailySummaries(params);
      setDailyData(res.data.dailySummaries || []);
      setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to fetch daily aggregations');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({
      ...prev,
      [key]: val,
      page: 1
    }));
  };

  const handleClear = () => {
    setFilters({
      location: 'ALL',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 25
    });
  };

  const handleExportCsv = () => {
    const exportParams = { ...filters };
    if (exportParams.location === 'ALL') delete exportParams.location;
    delete exportParams.page;
    delete exportParams.limit;
    window.open(getExportDailyUrl(exportParams), '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Daily Meteorological Summary</h1>
          <p className="page-subtitle">
            Daily aggregations of minimum, maximum, and average temperature, humidity, and rainfall.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCsv}>
          📥 Export Daily Summary (CSV)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card mb-4 filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="dailyLocation">Location / Station</label>
            <select
              id="dailyLocation"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="form-control"
            >
              <option value="ALL">All Stations Combined ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="dailyStartDate">From Date</label>
            <input
              type="date"
              id="dailyStartDate"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dailyEndDate">To Date</label>
            <input
              type="date"
              id="dailyEndDate"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="form-control"
            />
          </div>
        </div>

        <div className="filter-footer flex-between mt-3">
          <span className="text-secondary font-sm">
            Total Observation Dates: <strong>{pagination.total?.toLocaleString() || 0}</strong> days recorded
          </span>
          <button className="btn btn-sm btn-secondary" onClick={handleClear}>
            ✕ Clear Date Filters
          </button>
        </div>
      </div>

      {/* Daily Data Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="page-loader py-5">
              <div className="spinner"></div>
              <p>Computing daily metrics from database records...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Observation Date</th>
                    <th>Records</th>
                    <th>Temp Range (Min / Mean / Max)</th>
                    <th>Humidity Range (Min / Mean / Max)</th>
                    <th>Precipitation (Avg / Total / Max)</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d) => (
                    <tr key={d.date}>
                      <td><strong>{d.date}</strong></td>
                      <td>
                        <span className="badge badge-neutral">{d.observation_count} obs</span>
                      </td>
                      <td>
                        <div className="metric-compound">
                          <span className="text-info">{d.min_temperature ?? '—'}</span>
                          <span className="text-muted font-sm"> / </span>
                          <strong className="text-primary">{d.avg_temperature ?? '—'} °C</strong>
                          <span className="text-muted font-sm"> / </span>
                          <span className="text-danger">{d.max_temperature ?? '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="metric-compound">
                          <span>{d.min_humidity ?? '—'}</span>
                          <span className="text-muted font-sm"> / </span>
                          <strong className="text-teal">{d.avg_humidity ?? '—'} %</strong>
                          <span className="text-muted font-sm"> / </span>
                          <span>{d.max_humidity ?? '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="metric-compound">
                          <span>{d.avg_rainfall ?? '0.00'} mm</span>
                          <span className="text-muted font-sm"> | </span>
                          <span className="badge badge-primary font-bold">{d.total_rainfall ?? '0.00'} mm</span>
                          <span className="text-muted font-sm"> | max: </span>
                          <span>{d.max_rainfall ?? '0.00'} mm</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {dailyData.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-5">
                        No daily summary observations found for the specified filters.
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
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} days)
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
