import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart
} from 'recharts';
import { getTrends, getLocations, getSummary, getLatestAnalysis } from '../services/api';

export default function ChartsPage() {
  const [trends, setTrends] = useState([]);
  const [locationSummary, setLocationSummary] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadTrendsData();
  }, [selectedLocation]);

  const loadMeta = async () => {
    try {
      const [locRes, sumRes, analRes] = await Promise.all([
        getLocations(),
        getSummary(),
        getLatestAnalysis()
      ]);
      setLocations(locRes.data || []);
      setLocationSummary(sumRes.data.locationBreakdown || []);
      setDateRange(sumRes.data.kpis?.dateRange || { from: '', to: '' });
      setAnalysis(analRes.data);
    } catch (err) {
      console.error('Failed to load chart metadata:', err);
    }
  };

  const loadTrendsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedLocation !== 'ALL') {
        params.location = selectedLocation;
      }
      const res = await getTrends(params);
      setTrends(res.data.monthlyTrends || []);
    } catch (err) {
      setError(err.message || 'Failed to load trends data');
    } finally {
      setLoading(false);
    }
  };

  const activeLocLabel = selectedLocation === 'ALL'
    ? `All Monitored Stations (${locations.length} Locations)`
    : selectedLocation;

  const activePeriodLabel = dateRange.from && dateRange.to
    ? `${dateRange.from} to ${dateRange.to}`
    : 'Historical Observation Period';

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Interactive Visual Weather Charts</h1>
          <p className="page-subtitle">
            Historical climate envelopes, precipitation metrics, and humidity variations.
          </p>
        </div>
        <div className="chart-filter-box">
          <label htmlFor="chartLocSelect" className="font-sm font-bold mr-2 text-secondary">
            Focus Location:
          </label>
          <select
            id="chartLocSelect"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
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
      </div>

      {/* Observation Context Banner */}
      <div className="info-banner mb-4">
        <span>📍 <strong>Location Scope:</strong> <span className="badge badge-primary">{activeLocLabel}</span></span>
        <span>📅 <strong>Observation Period:</strong> <span className="badge badge-info">{activePeriodLabel}</span></span>
        <span className="text-muted font-sm">(Interactive Recharts + Server-Side Matplotlib Figures)</span>
      </div>

      {loading ? (
        <div className="page-loader py-5">
          <div className="spinner"></div>
          <p>Rendering climate charts...</p>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : trends.length === 0 ? (
        <div className="alert alert-warning">
          No observation data found for the selected station to render charts.
        </div>
      ) : (
        <div className="charts-grid">
          {/* Chart 1: Temperature Trend */}
          <div className="card chart-card mb-4">
            <div className="card-header flex-between">
              <div>
                <h3>🌡️ Temperature Trends & Observed Extremes (°C)</h3>
                <p className="text-secondary font-sm">
                  Scope: <strong>{activeLocLabel}</strong> | Period: <strong>{activePeriodLabel}</strong>
                </p>
              </div>
              <span className="badge badge-neutral">Units: Celsius (°C)</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={trends} margin={{ top: 15, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                  <YAxis unit="°C" tick={{ fill: '#94a3b8' }} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    formatter={(val, name) => [`${val} °C`, name]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area
                    type="monotone"
                    dataKey="max_temperature"
                    name="Max Observed Temp (°C)"
                    stroke="#ef4444"
                    fill="#fee2e2"
                    fillOpacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_temperature"
                    name="Mean Temp (°C)"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="min_temperature"
                    name="Min Observed Temp (°C)"
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Monthly Rainfall Bar Chart */}
          <div className="card chart-card mb-4">
            <div className="card-header flex-between">
              <div>
                <h3>🌧️ Monthly Precipitation Totals (mm)</h3>
                <p className="text-secondary font-sm">
                  Scope: <strong>{activeLocLabel}</strong> | Period: <strong>{activePeriodLabel}</strong>
                </p>
              </div>
              <span className="badge badge-primary">Units: Millimeters (mm)</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={trends} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                  <YAxis unit=" mm" tick={{ fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(val) => [`${val} mm`, 'Total Precipitation']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar
                    dataKey="total_rainfall"
                    name="Cumulative Monthly Rainfall (mm)"
                    fill="#0284c7"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Humidity Trends */}
          <div className="card chart-card mb-4">
            <div className="card-header flex-between">
              <div>
                <h3>💧 Historical Relative Humidity Trends (%)</h3>
                <p className="text-secondary font-sm">
                  Scope: <strong>{activeLocLabel}</strong> | Period: <strong>{activePeriodLabel}</strong>
                </p>
              </div>
              <span className="badge badge-teal">Units: Percentage (%)</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={trends} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(val) => [`${val} %`, 'Avg Relative Humidity']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line
                    type="monotone"
                    dataKey="avg_humidity"
                    name="Mean Relative Humidity (%)"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Monthly Temperature Comparison Across Stations */}
          {locationSummary.length > 0 && selectedLocation === 'ALL' && (
            <div className="card chart-card mb-4">
              <div className="card-header flex-between">
                <div>
                  <h3>📍 Cross-Station Baseline Temperature Comparison (°C)</h3>
                  <p className="text-secondary font-sm">
                    Mean temperature benchmarks compared across all active monitoring stations
                  </p>
                </div>
                <span className="badge badge-neutral">Units: Celsius (°C)</span>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={locationSummary} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="location" tick={{ fill: '#94a3b8' }} />
                    <YAxis unit="°C" tick={{ fill: '#94a3b8' }} />
                    <Tooltip
                      formatter={(val) => [`${val} °C`, 'Baseline Mean Temperature']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar
                      dataKey="avg_temp"
                      name="Mean Historical Temperature (°C)"
                      fill="#6366f1"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Server-Side Matplotlib Visualizations */}
          {analysis?.charts && analysis.charts.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h3>📊 Publication-Grade Matplotlib Figures (Server-Generated)</h3>
                <p className="text-secondary font-sm">
                  High-fidelity static plots generated by the Python analytics engine using Matplotlib.
                </p>
              </div>
              <div className="card-body">
                <div className="matplotlib-gallery">
                  {analysis.charts.map((chartFile) => (
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
          )}
        </div>
      )}
    </div>
  );
}
