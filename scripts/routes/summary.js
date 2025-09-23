const express = require('express');
const { generateSummary, SummaryServiceError } = require('../services/summaryService');

function createSummaryRouter({ logger }) {
  const router = express.Router();

  router.post('/summary', async (req, res) => {
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

    try {
      const responsePayload = await generateSummary({
        csv,
        csvFileName,
        promptXml,
        modelConfig,
        settings,
        reason
      });

      logger.info('Summary generated successfully', {
        responseId: responsePayload.responseId,
        containerId: responsePayload.containerId,
        bytesProcessed: responsePayload.bytesReceived,
        summaryLength: responsePayload.summary.length
      });

      res.json(responsePayload);
    } catch (error) {
      const status = error instanceof SummaryServiceError ? error.status : error?.status || 500;

      logger.error('Summary generation failed', {
        status,
        message: error.message,
        code: error.code || undefined,
        detail: error.detail || undefined,
        cause: error.cause ? { message: error.cause.message, name: error.cause.name } : undefined
      });

      const responseBody = {
        error: status >= 500 ? 'Failed to generate summary.' : error.message,
        code: error.code || undefined
      };

      res.status(status).json(responseBody);
    }
  });

  return router;
}

module.exports = createSummaryRouter;

