import { SUMMARY_CSV_FILENAME } from '../constants.js';

const SUMMARY_ENDPOINT = '/api/llm/summary';

export function sendSummaryRequest({ csvText, promptXml, modelConfig, settings, reason, signal }) {
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('Fetch API unavailable for summary generation.'));
  }

  const payload = {
    csv: csvText,
    csvFileName: SUMMARY_CSV_FILENAME,
    promptXml,
    modelConfig,
    settings,
    reason: reason || 'unspecified'
  };

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  };

  if (signal) {
    requestOptions.signal = signal;
  }

  return fetch(SUMMARY_ENDPOINT, requestOptions).then((response) => {
    if (!response.ok) {
      return response.text().then((text) => {
        throw new Error(text || `Summary request failed with status ${response.status}`);
      });
    }

    return response.json();
  });
}

export function notifySummaryCancellation({ reason, source } = {}) {
  if (typeof fetch !== 'function') {
    return Promise.resolve();
  }

  const payload = {
    reason: reason || 'unspecified',
    source: source || 'extension'
  };

  return fetch(`${SUMMARY_ENDPOINT}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}
