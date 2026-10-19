import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ health, isOpen, onClose }) {
  const navItems = [
    { to: '/', label: 'Overview', icon: '📊' },
    { to: '/upload', label: 'CSV Upload', icon: '📤' },
    { to: '/records', label: 'Weather Records', icon: '📜' },
    { to: '/daily-summary', label: 'Daily Summary', icon: '📅' },
    { to: '/monthly-analysis', label: 'Monthly Analysis', icon: '🗓️' },
    { to: '/charts', label: 'Visual Charts', icon: '📈' },
    { to: '/data-quality', label: 'Data Quality & Logs', icon: '🛡️' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose}></div>}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-logo">
            <span className="logo-icon">🌦️</span>
            <div>
              <h2 className="logo-text">WeatherAnalytics</h2>
              <span className="logo-tag">Historical Intelligence</span>
            </div>
          </div>
          <button className="mobile-close-btn" onClick={onClose} aria-label="Close Sidebar">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">MAIN NAVIGATION</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="link-icon">{item.icon}</span>
              <span className="link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="system-status-box">
            <div className="status-header">
              <span className="status-label">SYSTEM & DATABASE</span>
              <span className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`}></span>
            </div>
            <div className="status-detail">
              {health?.status === 'ok' ? (
                <>
                  <div className="db-name">MySQL: <strong>{health.database}</strong></div>
                  <div className="db-port">Port: 5000 (API Active)</div>
                </>
              ) : (
                <div className="db-offline">Database Disconnected</div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
