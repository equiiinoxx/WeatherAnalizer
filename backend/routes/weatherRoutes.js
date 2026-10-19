const express = require('express');
const weatherController = require('../controllers/weatherController');

const router = express.Router();

router.get('/records', weatherController.listRecords);
router.get('/locations', weatherController.getLocations);
router.get('/summary', weatherController.getSummary);
router.get('/trends', weatherController.getTrends);
router.get('/export', weatherController.exportCsv);

module.exports = router;
