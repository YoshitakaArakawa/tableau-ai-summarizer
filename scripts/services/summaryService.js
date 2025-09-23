const { OpenAI, APIError, toFile } = require('openai');

const DEFAULT_FILE_NAME = 'summary_data.csv';

class SummaryServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'SummaryServiceError';
    this.status = options.status || 500;
    this.code = options.code || null;
    this.cause = options.cause;
    this.detail = options.detail;
  }
}

let openAiClient = null;

function resolveOpenAiClient() {
  if (openAiClient) {
    return openAiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new SummaryServiceError('OpenAI API key not configured.', {
      status: 500,
      code: 'OPENAI_API_KEY_MISSING'
    });
  }

  const clientOptions = { apiKey };
  openAiClient = new OpenAI(clientOptions);
  return openAiClient;
}

function normalizeReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return 'unspecified';
  }

  const trimmed = reason.trim();
  return trimmed ? trimmed : 'unspecified';
}

function sanitizeContainerName(reason) {
  const normalizedReason = normalizeReason(reason);
  const timestamp = Date.now().toString(36);
  const suffix = normalizedReason === 'unspecified'
    ? ''
    : '-' + normalizedReason.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

  const baseName = 'tableau-summary';
  let name = `${baseName}${suffix}-${timestamp}`.replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (name.length > 64) {
    name = name.slice(0, 64);
  }

  return name;
}

async function uploadCsvToContainer({ client, containerId, csv, fileName }) {
  const fileContent = await toFile(Buffer.from(csv, 'utf8'), fileName, { type: 'text/csv' });

  const createdFile = await client.containers.files.create(containerId, {
    file: fileContent
  });

  return createdFile;
}

function buildResponsesPayload({ modelConfig, promptXml, containerId, requestMetadata }) {
  if (!modelConfig || typeof modelConfig !== 'object') {
    throw new SummaryServiceError('Model configuration missing for summary generation.', {
      status: 400,
      code: 'MODEL_CONFIG_MISSING'
    });
  }

  if (!modelConfig.model) {
    throw new SummaryServiceError('Model identifier missing in configuration.', {
      status: 400,
      code: 'MODEL_ID_MISSING'
    });
  }

  const payload = {
    model: modelConfig.model,
    input: promptXml,
    tools: [
      {
        type: 'code_interpreter',
        container: containerId
      }
    ],
    metadata: requestMetadata
  };

  const reasoningEffort = modelConfig.modelSettings?.reasoning?.effort;
  if (reasoningEffort) {
    payload.reasoning = { effort: reasoningEffort };
  }

  const verbosity = modelConfig.modelSettings?.verbosity;
  if (verbosity) {
    payload.instructions = `Provide a ${verbosity} level executive summary of the provided Tableau data.`;
  }

  return payload;
}

function extractSummaryText(response) {
  if (!response) {
    return null;
  }

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        const textPart = item.content.find((part) => part?.type === 'output_text' && typeof part.text === 'string');
        if (textPart && textPart.text.trim()) {
          return textPart.text.trim();
        }
      }
    }
  }

  return null;
}

async function generateSummary({ csv, csvFileName, promptXml, modelConfig, settings, reason }) {
  try {
    if (!csv || typeof csv !== 'string' || !csv.trim()) {
      throw new SummaryServiceError('CSV payload is empty.', {
        status: 400,
        code: 'CSV_EMPTY'
      });
    }

    if (!promptXml || typeof promptXml !== 'string' || !promptXml.trim()) {
      throw new SummaryServiceError('Prompt payload is empty.', {
        status: 400,
        code: 'PROMPT_EMPTY'
      });
    }

    const bytesReceived = Buffer.byteLength(csv, 'utf8');
    const effectiveFileName = csvFileName && csvFileName.trim() ? csvFileName.trim() : DEFAULT_FILE_NAME;
    const normalizedReason = normalizeReason(reason);

    const client = resolveOpenAiClient();

    const container = await client.containers.create({
      name: sanitizeContainerName(normalizedReason)
    });

    const containerFile = await uploadCsvToContainer({
      client,
      containerId: container.id,
      csv,
      fileName: effectiveFileName
    });

    let settingsHash;
    if (settings) {
      try {
        settingsHash = Buffer.from(JSON.stringify(settings)).toString('base64').slice(0, 32);
      } catch (_error) {
        settingsHash = undefined;
      }
    }

    const metadata = {
      source: 'tableau-ai-summarizer',
      file_name: effectiveFileName,
      reason: normalizedReason,
      ...(settingsHash ? { settings_hash: settingsHash } : {})
    };

    const response = await client.responses.create(
      buildResponsesPayload({
        modelConfig,
        promptXml,
        containerId: container.id,
        requestMetadata: metadata
      })
    );

    const summaryText = extractSummaryText(response);

    if (!summaryText) {
      throw new SummaryServiceError('Model did not return a summary.', {
        status: 502,
        code: 'SUMMARY_EMPTY'
      });
    }

    return {
      summary: summaryText,
      bytesReceived,
      fileName: effectiveFileName,
      reason: normalizedReason,
      responseId: response.id,
      containerId: container.id,
      containerFileId: containerFile.id,
      model: modelConfig.model,
      usage: response.usage || null,
      createdAt: response?.created_at || null
    };
  } catch (error) {
    if (error instanceof SummaryServiceError) {
      throw error;
    }

    if (error instanceof APIError) {
      const serviceError = new SummaryServiceError(error.message || 'OpenAI API error during summary generation.', {
        status: error.status ?? 502,
        code: error.code || 'OPENAI_API_ERROR',
        cause: error,
        detail: error.error || null
      });
      throw serviceError;
    }

    const fallbackError = new SummaryServiceError('Unexpected error during summary generation.', {
      status: error?.status || 500,
      code: error?.code || 'SUMMARY_GENERATION_FAILED',
      cause: error
    });

    throw fallbackError;
  }
}

module.exports = {
  generateSummary,
  SummaryServiceError
};

