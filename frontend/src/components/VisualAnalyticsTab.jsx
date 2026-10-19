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
  BarChart,
} from 'recharts';
import { getTrends, getLocations, getSummary } from '../services/api';

export default function VisualAnalyticsTab() {
  const [trends, setTrends] = useState([]);
  const [locationSummary, setLocationSummary] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTrendsData();
  }, [selectedLocation]);

  const loadInitialData = async () => {
    try {
      const [locRes, summaryRes] = await Promise.all([
        getLocations(),
        getSummary()
      ]);
      setLocations(locRes.data || []);
      setLocationSummary(summaryRes.data.locationBreakdown || []);
    } catch (err) {
      console.error('Failed to load initial visual data:', err);
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
      setError(err.message || 'Failed to fetch trends');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-pane">
      <div className="pane-header flex-between">
        <div>
          <h2>Interactive Visual Analytics (Recharts)</h2>
          <p className="text-muted">
            Explore seasonal climate patterns, temperature variation envelopes, and precipitation trends.
          </p>
        </div>
        <div className="location-selector">
          <label className="mr-2">Focus Location:</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="form-control"
          >
            <option value="ALL">All Stations Aggregated</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loader">Rendering chart visualizations...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : trends.length === 0 ? (
        <div className="alert alert-warning">
          No observation data found for the selected location to render charts.
        </div>
      ) : (
        <div className="charts-container">
          {/* Chart 1: Temperature Trends (Min, Avg, Max) */}
          <div className="card chart-card mb-4">
            <div className="card-header">
              <h3>🌡️ Monthly Temperature Range & Mean Profile (°C)</h3>
              <span className="text-muted font-sm">
                Showing minimum, mean, and maximum observed temperatures by calendar month
              </span>
            </div>
            <div className="card-body chart-body">
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={trends} margin={{ top: 15, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b' }} />
                  <YAxis unit="°C" tick={{ fill: '#64748b' }} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    formatter={(val, name) => [`${val} °C`, name]}
                    contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area
                    type="monotone"
                    dataKey="max_temperature"
                    name="Max Observed Temp"
                    stroke="#ef4444"
                    fill="#fee2e2"
                    fillOpacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_temperature"
                    name="Mean Temp"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="min_temperature"
                    name="Min Observed Temp"
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Rainfall & Humidity Correlation by Month */}
          <div className="card chart-card mb-4">
            <div className="card-header">
              <h3>🌧️ Monthly Precipitation & Relative Humidity Dynamics</h3>
              <span className="text-muted font-sm">
                Cumulative precipitation (Bars, left axis) vs. Mean Relative Humidity (Line, right axis)
              </span>
            </div>
            <div className="card-body chart-body">
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={trends} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b' }} />
                  <YAxis
                    yAxisId="left"
                    unit=" mm"
                    tick={{ fill: '#0284c7' }}
                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: '#0284c7' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    unit="%"
                    tick={{ fill: '#10b981' }}
                    domain={[0, 100]}
                    label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight', fill: '#10b981' }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar
                    yAxisId="left"
                    dataKey="total_rainfall"
                    name="Total Rainfall (mm)"
                    fill="#0284c7"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avg_humidity"
                    name="Avg Relative Humidity (%)"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Comparative Station Benchmarks */}
          {locationSummary.length > 0 && selectedLocation === 'ALL' && (
            <div className="card chart-card">
              <div className="card-header">
                <h3>📍 Regional Temperature Comparison Across Stations</h3>
                <span className="text-muted font-sm">
                  Comparing baseline mean historical temperatures across monitored locations
                </span>
              </div>
              <div className="card-body chart-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={locationSummary}
                    margin={{ top: 15, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="location" tick={{ fill: '#64748b' }} />
                    <YAxis unit="°C" tick={{ fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val) => [`${val} °C`, 'Avg Temperature']}
                      contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar
                      dataKey="avg_temp"
                      name="Mean Temperature (°C)"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
