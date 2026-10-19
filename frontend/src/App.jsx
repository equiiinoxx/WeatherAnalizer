import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import UploadPage from './pages/UploadPage';
import RecordsPage from './pages/RecordsPage';
import DailySummaryPage from './pages/DailySummaryPage';
import MonthlyAnalysisPage from './pages/MonthlyAnalysisPage';
import ChartsPage from './pages/ChartsPage';
import DataQualityPage from './pages/DataQualityPage';
import { getHealth } from './services/api';
import './App.css';

function App() {
  const [health, setHealth] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  const checkHealth = async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'error' });
    }
  };

  return (
    <BrowserRouter>
      <div className="dashboard-layout">
        <Sidebar
          health={health}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="dashboard-main">
          {/* Mobile Top Header */}
          <header className="mobile-top-bar">
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Navigation Menu"
            >
              ☰
            </button>
            <div className="mobile-brand">
              <span className="brand-icon">🌦️</span>
              <span className="brand-text">Weather Analytics</span>
            </div>
            <div className={`health-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} title="MySQL Status"></div>
          </header>

          <main className="content-area">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/daily-summary" element={<DailySummaryPage />} />
              <Route path="/monthly-analysis" element={<MonthlyAnalysisPage />} />
              <Route path="/charts" element={<ChartsPage />} />
              <Route path="/data-quality" element={<DataQualityPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="dashboard-footer">
            <div className="footer-container">
              <p>
                <strong>Weather Data Analysis System</strong> — Historical Meteorological Intelligence & Quality Platform
              </p>
              <p className="footer-stack">
                Stack: React 19 • Vite • Recharts • Node.js/Express • MySQL 8.0 • Python (Pandas/NumPy/Matplotlib)
              </p>
              <p className="footer-disclaimer">
                Strictly historical observation records. Predictive forecasting is intentionally omitted per system specifications.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
