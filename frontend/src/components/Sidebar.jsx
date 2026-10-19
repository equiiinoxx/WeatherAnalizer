import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ health, isOpen, onClose }) {
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
          <div className="nav-group-label">PROJECT WORKSPACE</div>
          <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">📊</span>
            <span className="link-label">Overview Dashboard</span>
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">📤</span>
            <span className="link-label">Upload Weather CSV</span>
          </NavLink>
          <NavLink to="/records" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">📜</span>
            <span className="link-label">Weather Records</span>
          </NavLink>

          <div className="nav-group-label">ANALYSIS & OUTPUTS</div>
          <NavLink to="/monthly-analysis" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">🗓️</span>
            <span className="link-label">Monthly Summary</span>
          </NavLink>
          <NavLink to="/daily-summary" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">📅</span>
            <span className="link-label">Daily Min / Max / Avg</span>
          </NavLink>
          <NavLink to="/charts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">📈</span>
            <span className="link-label">Weather Trends & Charts</span>
          </NavLink>
          <NavLink to="/data-quality" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <span className="link-icon">🛡️</span>
            <span className="link-label">Data Quality Report</span>
          </NavLink>
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
