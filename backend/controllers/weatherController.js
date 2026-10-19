const weatherService = require('../services/weatherService');

async function listRecords(req, res) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      location: req.query.location,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      minTemp: req.query.minTemp,
      maxTemp: req.query.maxTemp,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };

    const result = await weatherService.getRecords(filters);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('List records error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve weather records: ' + error.message
    });
  }
}

async function getLocations(req, res) {
  try {
    const locations = await weatherService.getLocations();
    res.json({
      status: 'success',
      data: locations
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve locations: ' + error.message
    });
  }
}

async function getSummary(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await weatherService.getSummaryMetrics(filters);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to compute weather summary metrics: ' + error.message
    });
  }
}

async function getTrends(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await weatherService.getTrends(filters);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve weather trends: ' + error.message
    });
  }
}

async function exportCsv(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      minTemp: req.query.minTemp,
      maxTemp: req.query.maxTemp,
      search: req.query.search
    };

    const csvData = await weatherService.exportRecordsCsv(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="weather_historical_export.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export CSV: ' + error.message
    });
  }
}

module.exports = {
  listRecords,
  getLocations,
  getSummary,
  getTrends,
  exportCsv
};
