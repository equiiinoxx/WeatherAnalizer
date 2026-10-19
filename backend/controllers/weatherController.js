const weatherService = require('../services/weatherService');

/**
 * List weather records with pagination, location, and date-range filtering
 * Endpoint: GET /api/weather & GET /api/weather/records
 */
async function listRecords(req, res) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to,
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

/**
 * List available locations
 * Endpoint: GET /api/weather/locations
 */
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

/**
 * Get summary metrics & historical KPIs
 * Endpoint: GET /api/weather/summary
 */
async function getSummary(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to
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

/**
 * Get time-series trends
 * Endpoint: GET /api/weather/trends
 */
async function getTrends(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to
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

/**
 * Export filtered records to CSV
 * Endpoint: GET /api/weather/export
 */
async function exportCsv(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to,
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

/**
 * Get daily summary metrics (min, max, avg temp, humidity, rainfall)
 * Endpoint: GET /api/weather/daily
 */
async function getDailySummaries(req, res) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to
    };

    const result = await weatherService.getDailySummaries(filters);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get daily summaries error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve daily summaries: ' + error.message
    });
  }
}

/**
 * Export daily summary metrics to CSV
 * Endpoint: GET /api/weather/export-daily
 */
async function exportDailyCsv(req, res) {
  try {
    const filters = {
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to
    };

    const csvData = await weatherService.exportDailySummaryCsv(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="weather_daily_summary_export.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('Export daily summary CSV error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export daily summary CSV: ' + error.message
    });
  }
}

module.exports = {
  listRecords,
  getLocations,
  getSummary,
  getTrends,
  getDailySummaries,
  exportCsv,
  exportDailyCsv
};
