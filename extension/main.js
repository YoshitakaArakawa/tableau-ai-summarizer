import {
  SETTINGS_KEYS,
  DEFAULT_SETTINGS,
  SUMMARY_CSV_FILENAME
} from './constants.js';
import { ensureModelConfigLoaded, getModelConfig } from './services/runtimeConfig.js';
import { ensurePromptTemplateLoaded, buildPromptPayload } from './services/promptTemplate.js';
import { fetchSummaryDataCsv } from './services/summaryData.js';
import { buildSettingsReferenceXml } from './utils/xml.js';
import { sendSummaryRequest } from './services/apiClient.js';

let statusElement;
let outputElement;
let worksheet;
let isGenerating = false;

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message || '';
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

function triggerSummaryGeneration(reason) {
  if (!worksheet || isGenerating) {
    return;
  }

  isGenerating = true;
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
        reason
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
    .catch(handleError)
    .finally(() => {
      isGenerating = false;
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

  setStatus('Extension loading...');
  initializeExtension();
}

document.addEventListener('DOMContentLoaded', onDomReady);
