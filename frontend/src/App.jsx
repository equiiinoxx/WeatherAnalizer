import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import OverviewTab from './components/OverviewTab';
import IngestionTab from './components/IngestionTab';
import RecordsTab from './components/RecordsTab';
import VisualAnalyticsTab from './components/VisualAnalyticsTab';
import PythonAnalysisTab from './components/PythonAnalysisTab';
import { getHealth } from './services/api';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'error' });
    }
  };

  const handleDataImported = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
      />

      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewTab
            key={`overview-${refreshKey}`}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'ingestion' && (
          <IngestionTab
            key={`ingestion-${refreshKey}`}
            onDataImported={handleDataImported}
          />
        )}

        {activeTab === 'records' && (
          <RecordsTab key={`records-${refreshKey}`} />
        )}

        {activeTab === 'visual' && (
          <VisualAnalyticsTab key={`visual-${refreshKey}`} />
        )}

        {activeTab === 'python' && (
          <PythonAnalysisTab key={`python-${refreshKey}`} />
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>
            <strong>Weather Data Analysis System</strong> — Historical Climate Observation & Quality Assurance Platform
          </p>
          <p className="footer-tech">
            Stack: React • Vite • Express • MySQL 8.0 • Python (Pandas / NumPy / Matplotlib) • Recharts
          </p>
          <p className="footer-note">
            Strictly historical observations analysis. Forecasting and predictive modeling intentionally omitted.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
