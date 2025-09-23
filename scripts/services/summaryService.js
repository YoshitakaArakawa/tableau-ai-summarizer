function generateSummary({ csv, csvFileName, promptXml, modelConfig, settings, reason }) {
  const bytesReceived = Buffer.byteLength(csv, 'utf8');

  return {
    summary: 'LLM integration pending: summary generation not yet implemented.',
    bytesReceived,
    fileName: csvFileName || null,
    reason: reason || 'unspecified'
  };
}

module.exports = {
  generateSummary
};
