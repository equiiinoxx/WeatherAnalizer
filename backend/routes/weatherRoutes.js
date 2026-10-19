const express = require('express');
const weatherController = require('../controllers/weatherController');
const importController = require('../controllers/importController');
const handleUploadMiddleware = require('./uploadMiddleware');

const router = express.Router();

// Primary endpoints per requirements
// GET /api/weather with pagination, location, and date-range filtering
router.get('/', weatherController.listRecords);
router.get('/records', weatherController.listRecords); // Alias

// GET /api/weather/locations to list available locations
router.get('/locations', weatherController.getLocations);

// POST /api/weather/upload for CSV uploads using Multer and csv-parse
router.post('/upload', handleUploadMiddleware, importController.handleUpload);

// Import history and data-quality reports
router.get('/imports', importController.listBatches);
router.get('/imports/:batchId', importController.getBatchDetails);
router.get('/imports/:batchId/issues', importController.getBatchIssues);
router.get('/imports/:batchId/export-issues', importController.exportBatchIssues);
router.get('/quality-issues', importController.getAllQualityIssues);
router.get('/quality-issues/export', importController.exportBatchIssues);

// Metrics, daily summaries, trends, and export endpoints
router.get('/summary', weatherController.getSummary);
router.get('/daily', weatherController.getDailySummaries);
router.get('/trends', weatherController.getTrends);
router.get('/export', weatherController.exportCsv);
router.get('/export-daily', weatherController.exportDailyCsv);

module.exports = router;
