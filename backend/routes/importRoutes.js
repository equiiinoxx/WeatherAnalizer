const express = require('express');
const importController = require('../controllers/importController');
const handleUploadMiddleware = require('./uploadMiddleware');

const router = express.Router();

router.post('/upload', handleUploadMiddleware, importController.handleUpload);
router.get('/batches', importController.listBatches);
router.get('/batches/:batchId', importController.getBatchDetails);
router.get('/batches/:batchId/issues', importController.getBatchIssues);
router.get('/issues', importController.getAllQualityIssues);

module.exports = router;
