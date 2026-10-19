const express = require('express');
const analysisController = require('../controllers/analysisController');

const router = express.Router();

router.post('/run', analysisController.triggerAnalysis);
router.get('/latest', analysisController.getLatestAnalysis);

module.exports = router;
