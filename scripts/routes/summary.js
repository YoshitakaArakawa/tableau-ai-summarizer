const express = require('express');
const { generateSummary } = require('../services/summaryService');

function createSummaryRouter({ logger }) {
  const router = express.Router();

  router.post('/summary', (req, res) => {
    const { csv, csvFileName, promptXml, modelConfig, settings, reason } = req.body || {};

    if (!csv || !promptXml || !modelConfig) {
      const received = {
        hasCsv: Boolean(csv),
        hasPrompt: Boolean(promptXml),
        hasModel: Boolean(modelConfig)
      };
      logger.warn('Summary request rejected: missing required fields', received);

      return res.status(400).json({
        error: 'Missing required fields for summary generation.',
        received
      });
    }

    const csvBytes = Buffer.byteLength(csv, 'utf8');
    const previewLimit = 500;
    const truncatedPreview = csv.length > previewLimit;
    const csvPreview = truncatedPreview ? `${csv.slice(0, previewLimit)}...` : csv;

    logger.info('Summary request received', {
      reason: reason || 'unspecified',
      csvFileName: csvFileName || 'summary_data.csv',
      csvBytes,
      promptXmlLength: promptXml.length,
      model: modelConfig,
      settingsSnapshot: settings,
      promptXml,
      csvPreviewLength: csvPreview.length,
      csvPreview,
      truncatedPreview
    });

    const responsePayload = generateSummary({
      csv,
      csvFileName,
      promptXml,
      modelConfig,
      settings,
      reason
    });

    logger.info('Summary response stubbed', responsePayload);
    res.json(responsePayload);
  });

  return router;
}

module.exports = createSummaryRouter;

