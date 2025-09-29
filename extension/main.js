import {
  SETTINGS_KEYS,
  DEFAULT_SETTINGS,
  SUMMARY_CSV_FILENAME
} from './constants.js';
import { ensureModelConfigLoaded, getModelConfig } from './services/runtimeConfig.js';
import { ensurePromptTemplateLoaded, buildPromptPayload } from './services/promptTemplate.js';
import { fetchSummaryDataCsv } from './services/summaryData.js';
import { buildSettingsReferenceXml } from './utils/xml.js';
import { sendSummaryRequest, notifySummaryCancellation } from './services/apiClient.js';

let statusElement;
let outputElement;
let regenerateButton;
let cancelButton;
let worksheet;
let isGenerating = false;
let activeAbortController = null;

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message || '';
  }
}

function setGeneratingState(running) {
  isGenerating = running;

  if (regenerateButton) {
    regenerateButton.disabled = running;
  }

  if (cancelButton) {
    cancelButton.disabled = !running;
  }
}

function handleError(error) {
  console.error('[Extension] Error', error);
  const message = error && error.message ? error.message : 'Unexpected error';
  setStatus(message);
}

function getCurrentSettings() {
  const stored = tableau.extensions.settings.getAll();
  return {
    [SETTINGS_KEYS.period]: stored[SETTINGS_KEYS.period] || DEFAULT_SETTINGS[SETTINGS_KEYS.period],
    [SETTINGS_KEYS.additive]: stored[SETTINGS_KEYS.additive] || DEFAULT_SETTINGS[SETTINGS_KEYS.additive],
    [SETTINGS_KEYS.trend]: stored[SETTINGS_KEYS.trend] || DEFAULT_SETTINGS[SETTINGS_KEYS.trend]
  };
}

function buildSummaryReferenceXml() {
  return '<dataReference file="' + SUMMARY_CSV_FILENAME + '" />';
}

function cancelActiveSummary() {
  if (!isGenerating || !activeAbortController) {
    return;
  }

  setStatus('Cancelling summary request...');

  const controller = activeAbortController;
  activeAbortController = null;
  controller.abort();

  if (cancelButton) {
    cancelButton.disabled = true;
  }

  notifySummaryCancellation({
    reason: 'manual-cancel',
    source: 'extension-button'
  }).catch(() => {});
}

function triggerSummaryGeneration(reason) {
  if (!worksheet || isGenerating) {
    return;
  }

  const abortController = new AbortController();
  activeAbortController = abortController;
  setGeneratingState(true);
  const suffix = reason ? ' (' + reason + ')' : '';
  setStatus('Generating summary' + suffix + '...');

  Promise.all([ensureModelConfigLoaded(), ensurePromptTemplateLoaded()])
    .then(() => {
      const settingsSnapshot = getCurrentSettings();
      return fetchSummaryDataCsv(worksheet).then((csvText) => ({ csvText, settingsSnapshot }));
    })
    .then(({ csvText, settingsSnapshot }) => {
      const summaryXml = buildSummaryReferenceXml();
      const settingsXml = buildSettingsReferenceXml(settingsSnapshot);
      const promptXml = buildPromptPayload({ summaryXml, settingsXml });
      const modelConfig = getModelConfig();

      if (!modelConfig) {
        throw new Error('Model configuration unavailable.');
      }

      return sendSummaryRequest({
        csvText,
        promptXml,
        modelConfig,
        settings: settingsSnapshot,
        reason,
        signal: abortController.signal
      });
    })
    .then((response) => {
      if (response && typeof response.summary === 'string') {
        if (outputElement) {
          outputElement.value = response.summary;
        }
        setStatus('Summary updated.');
      } else {
        setStatus('Summary request completed without content.');
      }
    })
    .catch((error) => {
      if (error && error.name === 'AbortError') {
        setStatus('Summary request cancelled.');
        return;
      }

      handleError(error);
    })
    .finally(() => {
      activeAbortController = null;
      setGeneratingState(false);
    });
}

function openConfigurationDialog() {
  const configUrl = new URL('config.html', window.location.href).toString();
  const payload = JSON.stringify(getCurrentSettings());

  return tableau.extensions.ui
    .displayDialogAsync(configUrl, payload, { height: 420, width: 420 })
    .then((closePayload) => {
      if (closePayload) {
        setStatus(closePayload);
      }
    })
    .catch((error) => {
      if (error && error.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
        setStatus('Configuration dialog dismissed.');
        return;
      }
      handleError(error);
    });
}

function registerEventListeners() {
  const settings = tableau.extensions.settings;
  settings.addEventListener(tableau.TableauEventType.SettingsChanged, () => {
    setStatus('Settings updated. Regenerating summary...');
    triggerSummaryGeneration('settings-change');
  });

  worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => {
    setStatus('Worksheet data changed. Regenerate summary if needed.');
  });
}

function initializeExtension() {
  setStatus('Connecting to Tableau...');

  tableau.extensions
    .initializeAsync({ configure: openConfigurationDialog })
    .then(() => {
      worksheet = tableau.extensions.worksheetContent && tableau.extensions.worksheetContent.worksheet;

      if (!worksheet) {
        setStatus('Worksheet context unavailable.');
        return;
      }

      registerEventListeners();

      if (outputElement) {
        outputElement.value = '';
      }

      triggerSummaryGeneration('initial-load');
    })
    .catch(handleError);
}

function onDomReady() {
  statusElement = document.getElementById('status');
  outputElement = document.getElementById('llmText');
  regenerateButton = document.getElementById('regenerateBtn');
  cancelButton = document.getElementById('cancelBtn');

  if (regenerateButton) {
    regenerateButton.addEventListener('click', () => {
      triggerSummaryGeneration('manual-retry');
    });
    regenerateButton.disabled = true;
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      cancelActiveSummary();
    });
    cancelButton.disabled = true;
  }

  setStatus('Extension loading...');
  initializeExtension();
}

document.addEventListener('DOMContentLoaded', onDomReady);
