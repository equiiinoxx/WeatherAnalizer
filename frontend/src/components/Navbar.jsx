import React from 'react';

export default function Navbar({ activeTab, setActiveTab, health }) {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="brand-icon">🌦️</div>
          <div>
            <h1 className="brand-title">Weather Data Analysis System</h1>
            <p className="brand-subtitle">Historical Observation & Quality Assurance Engine</p>
          </div>
        </div>

        <div className="system-health-badge">
          {health?.status === 'ok' ? (
            <div className="health-indicator online" title={`Connected to MySQL: ${health.database}`}>
              <span className="dot pulse"></span>
              <span>MySQL 8.0: <strong>{health.database}</strong></span>
            </div>
          ) : (
            <div className="health-indicator offline" title="Backend/DB Offline">
              <span className="dot"></span>
              <span>Database Disconnected</span>
            </div>
          )}
        </div>
      </div>

      <nav className="nav-tabs-container">
        <div className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 System Overview & KPIs
          </button>
          <button
            className={`tab-btn ${activeTab === 'ingestion' ? 'active' : ''}`}
            onClick={() => setActiveTab('ingestion')}
          >
            📁 CSV Import & Quality Log
          </button>
          <button
            className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            📜 Observation Records
          </button>
          <button
            className={`tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
            onClick={() => setActiveTab('visual')}
          >
            📈 Visual Analytics (Recharts)
          </button>
          <button
            className={`tab-btn ${activeTab === 'python' ? 'active' : ''}`}
            onClick={() => setActiveTab('python')}
          >
            🔬 Python Statistical Engine
          </button>
        </div>
      </nav>
    </header>
  );
}
