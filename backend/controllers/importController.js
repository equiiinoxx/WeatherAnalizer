const importService = require('../services/importService');

async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No CSV file was uploaded. Please choose a valid .csv file.'
      });
    }

    const originalFilename = req.file.originalname;
    const filePath = req.file.path;

    const result = await importService.processCsvUpload(filePath, originalFilename);

    res.status(201).json({
      status: 'success',
      message: `File processed successfully. ${result.acceptedRows} records accepted, ${result.rejectedRows} rejected.`,
      data: result
    });
  } catch (error) {
    console.error('Import upload error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process CSV file: ' + error.message
    });
  }
}

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

async function getBatchIssues(req, res) {
  try {
    const batchId = req.params.batchId;
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

module.exports = {
  handleUpload,
  listBatches,
  getBatchIssues
};
