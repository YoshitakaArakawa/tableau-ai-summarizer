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
import { renderChart } from './services/chartRenderer.js';
import { applyDateFilter } from './services/dateFilter.js';

const MEASURE_ENCODING_ID = 'measure';
const DATE_ENCODING_ID = 'time';

function collectEncodingFields(encoding) {
  if (!encoding) {
    return [];
  }

  const fields = [];

  if (encoding.field) {
    fields.push(encoding.field);
  }

  if (Array.isArray(encoding.fields)) {
    fields.push(...encoding.fields);
  }

  return fields.filter(Boolean);
}

function sanitizeEncodingFieldDescriptor(field) {
  if (!field) {
    return null;
  }

  const fieldName = field.fieldName || field.name || '';
  const displayName = field.caption || field.alias || field.displayName || field.name || field.fieldName || '';
  const dataType = (field.dataType || field.fieldType || '').toString().toLowerCase();

  if (!fieldName && !displayName) {
    return null;
  }

  return {
    fieldName: fieldName || displayName,
    displayName: displayName || fieldName,
    name: field.name || '',
    caption: field.caption || '',
    dataType
  };
}

function formatFieldLabel(field) {
  if (!field) {
    return '';
  }

  return field.displayName || field.fieldName || field.name || '';
}

async function getRequiredEncodingAssignments(targetWorksheet) {
  if (!targetWorksheet) {
    throw new Error('Worksheet context unavailable.');
  }

  let visualSpecification;

  try {
    visualSpecification = await targetWorksheet.getVisualSpecificationAsync();
  } catch (error) {
    console.error('[Extension] Visual specification unavailable', error);
    throw new Error('Unable to inspect worksheet encodings. Ensure Tableau Desktop 2021.4 or later is in use.');
  }

  if (!visualSpecification || !Array.isArray(visualSpecification?.marksSpecifications)) {
    throw new Error('Worksheet encodings could not be determined.');
  }

  const activeIndex = visualSpecification.activeMarksSpecificationIndex;

  if (typeof activeIndex !== 'number' || activeIndex < 0 || !visualSpecification.marksSpecifications[activeIndex]) {
    throw new Error('No active marks card found. Assign fields to the worksheet before generating a summary.');
  }

  const marksSpecification = visualSpecification.marksSpecifications[activeIndex];
  const encodings = marksSpecification.encodings || [];

  const findEncoding = (id) => encodings.find((encoding) => encoding && encoding.id === id);

  const measureFields = collectEncodingFields(findEncoding(MEASURE_ENCODING_ID));

  if (measureFields.length === 0) {
    throw new Error('Assign exactly one field to the Measure slot before generating the summary.');
  }

  if (measureFields.length > 1) {
    throw new Error('Only one field may be placed on the Measure slot. Remove additional fields and try again.');
  }

  const measureInfo = sanitizeEncodingFieldDescriptor(measureFields[0]);

  if (!measureInfo) {
    throw new Error('The Measure field could not be interpreted. Please reassign the field and try again.');
  }

  const dateFields = collectEncodingFields(findEncoding(DATE_ENCODING_ID));

  if (dateFields.length === 0) {
    throw new Error('Assign exactly one field to the Date slot before generating the summary.');
  }

  if (dateFields.length > 1) {
    throw new Error('Only one field may be placed on the Date slot. Remove additional fields and try again.');
  }

  const dateInfo = sanitizeEncodingFieldDescriptor(dateFields[0]);

  if (!dateInfo) {
    throw new Error('The Date field could not be interpreted. Please reassign the field and try again.');
  }

  const detailFields = [];

  encodings.forEach((encoding) => {
    if (!encoding || encoding.id === MEASURE_ENCODING_ID || encoding.id === DATE_ENCODING_ID) {
      return;
    }

    collectEncodingFields(encoding).forEach((field) => {
      const sanitized = sanitizeEncodingFieldDescriptor(field);
      if (sanitized) {
        detailFields.push(sanitized);
      }
    });
  });

  return {
    measure: measureInfo,
    date: dateInfo,
    detail: detailFields
  };
}

let statusElement;
let outputElement;
let generateButton;
let cancelButton;
let worksheet;
let isGenerating = false;
let activeAbortController = null;
let chartCanvas;
let chartContainer;

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message || '';
  }
}

function setGeneratingState(running) {
  isGenerating = running;

  if (generateButton) {
    generateButton.disabled = running;
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
    [SETTINGS_KEYS.trend]: stored[SETTINGS_KEYS.trend] || DEFAULT_SETTINGS[SETTINGS_KEYS.trend],
    [SETTINGS_KEYS.language]: stored[SETTINGS_KEYS.language] || DEFAULT_SETTINGS[SETTINGS_KEYS.language],
    [SETTINGS_KEYS.cumulative]: stored[SETTINGS_KEYS.cumulative] || DEFAULT_SETTINGS[SETTINGS_KEYS.cumulative],
    [SETTINGS_KEYS.timezone]: stored[SETTINGS_KEYS.timezone] || DEFAULT_SETTINGS[SETTINGS_KEYS.timezone]
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

function triggerSummaryGeneration(reason = 'manual') {
  if (!worksheet || isGenerating) {
    return;
  }

  const abortController = new AbortController();
  activeAbortController = abortController;
  setGeneratingState(true);
  setStatus('Validating worksheet encodings...');

  Promise.all([ensureModelConfigLoaded(), ensurePromptTemplateLoaded()])
    .then(() => getRequiredEncodingAssignments(worksheet))
    .then(async (encodingAssignments) => {
      const settingsSnapshot = getCurrentSettings();
      const periodType = settingsSnapshot[SETTINGS_KEYS.period];
      const timezone = settingsSnapshot[SETTINGS_KEYS.timezone] || 'UTC';
      const dateFieldName = encodingAssignments.date.fieldName;

      // Apply date filter before fetching summary data
      setStatus('Applying date filter...');
      try {
        await applyDateFilter(worksheet, dateFieldName, periodType, timezone);
      } catch (error) {
        console.warn('[Extension] Failed to apply date filter before summary', error);
      }

      setStatus('Fetching summary data...');
      return fetchSummaryDataCsv(worksheet, encodingAssignments, periodType, timezone).then(({ csvText, summaryMetadata, chartData }) => ({
        csvText,
        settingsSnapshot,
        summaryMetadata,
        encodingAssignments,
        chartData
      }));
    })
    .then(({ csvText, settingsSnapshot, summaryMetadata, encodingAssignments, chartData }) => {
      const summaryXml = buildSummaryReferenceXml();
      const settingsXml = buildSettingsReferenceXml(settingsSnapshot, summaryMetadata);
      const measureLabel = formatFieldLabel(summaryMetadata.measure) || formatFieldLabel(encodingAssignments.measure);
      const dateLabel = formatFieldLabel(summaryMetadata.date) || formatFieldLabel(encodingAssignments.date);

      window.currentEncodingAssignments = encodingAssignments;
      window.currentSummaryMetadata = summaryMetadata;

      if (measureLabel && dateLabel) {
        setStatus(`Generating summary for ${measureLabel} by ${dateLabel}...`);
      } else {
        setStatus('Generating summary...');
      }

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
      }).then((response) => ({ response, chartData, settingsSnapshot, summaryMetadata, encodingAssignments }));
    })
    .then(({ response }) => {
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
    setStatus('Settings updated. Applying date filter...');
    applyDateFilterFromSettings().catch((error) => {
      console.warn('[Extension] Failed to apply date filter on settings change', error);
      setStatus('Settings updated. Click "Generate Summary" to refresh.');
    });
  });

  worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => {
    setStatus('Worksheet data changed. Refreshing chart...');
    renderChartFromWorksheet().catch((error) => {
      console.warn('[Extension] Failed to auto-render chart on data change', error);
      setStatus('Worksheet data changed. Click "Generate Summary" when you are ready to refresh.');
    });
  });
}

async function applyDateFilterFromSettings() {
  if (!worksheet) {
    return;
  }

  const currentSettings = getCurrentSettings();
  const periodType = currentSettings[SETTINGS_KEYS.period];
  const timezone = currentSettings[SETTINGS_KEYS.timezone] || 'UTC';

  try {
    const encodingAssignments = await getRequiredEncodingAssignments(worksheet);
    const dateFieldName = encodingAssignments.date.fieldName;

    await applyDateFilter(worksheet, dateFieldName, periodType, timezone);
    setStatus('Date filter applied. Refreshing chart...');

    // Auto-render chart after filter is applied
    await renderChartFromWorksheet();
  } catch (error) {
    console.warn('[Extension] Could not apply date filter', error);
    setStatus('Settings updated. Click "Generate Summary" to refresh.');
  }
}

async function renderChartFromWorksheet() {
  if (!worksheet || !chartCanvas) {
    return;
  }

  try {
    const currentSettings = getCurrentSettings();
    const periodType = currentSettings[SETTINGS_KEYS.period];
    const timezone = currentSettings[SETTINGS_KEYS.timezone] || 'UTC';

    // Hide chart for Last Day period type
    if (periodType === 'lastDay') {
      if (chartContainer) {
        chartContainer.style.display = 'none';
      }
      setStatus('Chart not available for Last Day period.');
      return;
    }

    const encodingAssignments = await getRequiredEncodingAssignments(worksheet);
    const { chartData, summaryMetadata } = await fetchSummaryDataCsv(worksheet, encodingAssignments, periodType, timezone);

    if (chartData && (chartData.comparison?.length > 0 || chartData.current?.length > 0)) {
      const isCumulative = currentSettings[SETTINGS_KEYS.cumulative] === 'true';
      const measureName = formatFieldLabel(summaryMetadata.measure) || formatFieldLabel(encodingAssignments.measure) || 'Value';

      renderChart(chartCanvas, chartData, {
        cumulative: isCumulative,
        measureName: measureName
      });

      if (chartContainer) {
        chartContainer.style.display = 'block';
      }
      setStatus('Chart updated.');
    } else {
      if (chartContainer) {
        chartContainer.style.display = 'none';
      }
      setStatus('No data available for chart.');
    }
  } catch (error) {
    console.warn('[Extension] Failed to render chart', error);
    if (chartContainer) {
      chartContainer.style.display = 'none';
    }
  }
}

function initializeExtension() {
  setStatus('Connecting to Tableau...');

  tableau.extensions
    .initializeAsync({ configure: openConfigurationDialog })
    .then(() => {
      worksheet = tableau.extensions.worksheetContent && tableau.extensions.worksheetContent.worksheet;

      if (!worksheet) {
        setStatus('Worksheet context unavailable.');

        if (generateButton) {
          generateButton.disabled = true;
        }

        return;
      }

      registerEventListeners();

      if (outputElement) {
        outputElement.value = '';
      }

      setStatus('Ready. Configure options and choose "Generate Summary".');

      if (generateButton) {
        generateButton.disabled = false;
      }

      if (cancelButton) {
        cancelButton.disabled = true;
      }
    })
    .catch(handleError);
}

function onDomReady() {
  statusElement = document.getElementById('status');
  outputElement = document.getElementById('llmText');
  generateButton = document.getElementById('generateBtn');
  cancelButton = document.getElementById('cancelBtn');
  chartCanvas = document.getElementById('trendChart');
  chartContainer = document.getElementById('chartContainer');

  if (generateButton) {
    generateButton.addEventListener('click', () => {
      triggerSummaryGeneration();
    });
    generateButton.disabled = true;
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




