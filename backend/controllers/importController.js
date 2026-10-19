const importService = require('../services/importService');
const fs = require('fs');

/**
 * Handle CSV File Upload
 */
async function handleUpload(req, res) {
  let uploadedFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No CSV file provided. Please attach a valid .csv file in the "file" field.'
      });
    }

    uploadedFilePath = req.file.path;
    const originalFilename = req.file.originalname;

    // Check if uploaded file is empty (0 bytes)
    const stats = fs.statSync(uploadedFilePath);
    if (stats.size === 0) {
      if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({
        status: 'error',
        message: 'Uploaded file is empty (0 bytes). Please upload a valid CSV file with header and data rows.'
      });
    }

    const result = await importService.processCsvUpload(uploadedFilePath, originalFilename);

    res.status(201).json({
      status: 'success',
      message: `File processed: ${result.acceptedRows} records accepted, ${result.rejectedRows} records rejected.`,
      data: result
    });
  } catch (error) {
    console.error('Import upload error:', error.message);

    // Clean up file if not cleaned by service
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (e) {
        // ignore
      }
    }

    res.status(400).json({
      status: 'error',
      message: error.message || 'Failed to process CSV file'
    });
  }
}

/**
 * List Import Batches History
 */
async function listBatches(req, res) {
  try {
    const limit = parseInt(req.query.limit || 50, 10);
    const offset = parseInt(req.query.offset || 0, 10);

    const result = await importService.getImportBatches(limit, offset);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('List batches error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve import batches: ' + error.message
    });
  }
}

/**
 * Get details for a single batch
 */
async function getBatchDetails(req, res) {
  try {
    const batchId = req.params.batchId || req.params.id;
    const batch = await importService.getBatchById(batchId);

    if (!batch) {
      return res.status(404).json({
        status: 'error',
        message: `Import batch #${batchId} not found`
      });
    }

    res.json({
      status: 'success',
      data: batch
    });
  } catch (error) {
    console.error('Get batch details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve batch details: ' + error.message
    });
  }
}

/**
 * Get Quality Issues for a Batch
 */
async function getBatchIssues(req, res) {
  try {
    const batchId = req.params.batchId || req.params.id;
    const limit = parseInt(req.query.limit || 100, 10);
    const offset = parseInt(req.query.offset || 0, 10);

    const result = await importService.getBatchQualityIssues(batchId, limit, offset);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get batch issues error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve data quality issues: ' + error.message
    });
  }
}

/**
 * Get Global Quality Issues Report
 */
async function getAllQualityIssues(req, res) {
  try {
    const limit = parseInt(req.query.limit || 100, 10);
    const offset = parseInt(req.query.offset || 0, 10);
    const batchId = req.query.batchId ? parseInt(req.query.batchId, 10) : null;

    const result = await importService.getAllQualityIssues(limit, offset, batchId);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get all quality issues error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve quality issues report: ' + error.message
    });
  }
}

module.exports = {
  handleUpload,
  listBatches,
  getBatchDetails,
  getBatchIssues,
  getAllQualityIssues
};
