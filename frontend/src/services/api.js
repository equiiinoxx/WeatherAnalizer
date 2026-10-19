import axios from 'axios';

// Create Axios client with base URL pointing to /api or localhost:5000
const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// System Health
export const getHealth = async () => {
  const res = await api.get('/api/health');
  return res.data;
};

// Weather records & stats
export const getRecords = async (params = {}) => {
  const res = await api.get('/api/weather/records', { params });
  return res.data;
};

export const getLocations = async () => {
  const res = await api.get('/api/weather/locations');
  return res.data;
};

export const getSummary = async (params = {}) => {
  const res = await api.get('/api/weather/summary', { params });
  return res.data;
};

export const getTrends = async (params = {}) => {
  const res = await api.get('/api/weather/trends', { params });
  return res.data;
};

export const getExportUrl = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return `/api/weather/export?${query}`;
};

// Ingestion & Batches
export const uploadCsv = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/api/import/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const getBatches = async (limit = 50, offset = 0) => {
  const res = await api.get('/api/import/batches', { params: { limit, offset } });
  return res.data;
};

export const getBatchIssues = async (batchId, limit = 100, offset = 0) => {
  const res = await api.get(`/api/import/batches/${batchId}/issues`, { params: { limit, offset } });
  return res.data;
};

// Python Statistical Analysis
export const runPythonAnalysis = async () => {
  const res = await api.post('/api/analysis/run');
  return res.data;
};

export const getLatestAnalysis = async () => {
  const res = await api.get('/api/analysis/latest');
  return res.data;
};
