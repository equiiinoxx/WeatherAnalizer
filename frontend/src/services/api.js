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
  const res = await api.get('/api/weather', { params });
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

export const getDailySummaries = async (params = {}) => {
  const res = await api.get('/api/weather/daily', { params });
  return res.data;
};

export const getExportUrl = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return `/api/weather/export?${query}`;
};

export const getExportDailyUrl = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return `/api/weather/export-daily?${query}`;
};

export const getExportIssuesUrl = (batchId = null) => {
  if (batchId) {
    return `/api/weather/imports/${batchId}/export-issues`;
  }
  return `/api/weather/quality-issues/export`;
};

// Ingestion & Batches
export const uploadCsv = async (file, onProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/api/weather/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    }
  });
  return res.data;
};

export const getBatches = async (limit = 50, offset = 0) => {
  const res = await api.get('/api/weather/imports', { params: { limit, offset } });
  return res.data;
};

export const getBatchDetails = async (batchId) => {
  const res = await api.get(`/api/weather/imports/${batchId}`);
  return res.data;
};

export const getBatchIssues = async (batchId, limit = 100, offset = 0) => {
  const res = await api.get(`/api/weather/imports/${batchId}/issues`, { params: { limit, offset } });
  return res.data;
};

export const getAllQualityIssues = async (limit = 100, offset = 0, batchId = null) => {
  const params = { limit, offset };
  if (batchId) params.batchId = batchId;
  const res = await api.get('/api/weather/quality-issues', { params });
  return res.data;
};

// Python Statistical Analysis
export const runPythonAnalysis = async (params = {}) => {
  const res = await api.post('/api/analysis/run', params);
  return res.data;
};

export const getLatestAnalysis = async (params = {}) => {
  const res = await api.get('/api/analysis/latest', { params });
  return res.data;
};
