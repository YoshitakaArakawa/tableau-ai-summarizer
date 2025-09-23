(function () {
  const SETTINGS_KEYS = {
    period: 'period',
    additive: 'isAdditiveMetric',
    trend: 'trendMeaning'
  };

  const DEFAULT_SETTINGS = {
    [SETTINGS_KEYS.period]: 'daily',
    [SETTINGS_KEYS.additive]: 'false',
    [SETTINGS_KEYS.trend]: 'neutral'
  };

  const PERIOD_LABELS = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly'
  };

  const TREND_LABELS = {
    positive: 'Good (up is positive)',
    negative: 'Bad (up is negative)',
    neutral: 'Neutral'
  };

  const ENCODING_IDS = {
    measure: 'measure',
    time: 'time'
  };

  let statusElement;
  let outputElement;
  let measureElement;
  let timeElement;
  let periodElement;
  let additiveElement;
  let trendElement;
  let worksheet;

  function setStatus(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function handleError(error) {
    console.error('[Extension] Error', error);
    setStatus(`Initialization failed: ${error.message}`);
  }

  function getCurrentSettings() {
    const stored = tableau.extensions.settings.getAll();
    return {
      [SETTINGS_KEYS.period]: stored[SETTINGS_KEYS.period] || DEFAULT_SETTINGS[SETTINGS_KEYS.period],
      [SETTINGS_KEYS.additive]: stored[SETTINGS_KEYS.additive] || DEFAULT_SETTINGS[SETTINGS_KEYS.additive],
      [SETTINGS_KEYS.trend]: stored[SETTINGS_KEYS.trend] || DEFAULT_SETTINGS[SETTINGS_KEYS.trend]
    };
  }

  function applySettingsDisplay(settings) {
    if (periodElement) {
      const label = PERIOD_LABELS[settings[SETTINGS_KEYS.period]] || PERIOD_LABELS.daily;
      periodElement.textContent = label;
    }

    if (additiveElement) {
      const isAdditive = settings[SETTINGS_KEYS.additive] === 'true';
      additiveElement.textContent = isAdditive ? 'Yes' : 'No';
    }

    if (trendElement) {
      const label = TREND_LABELS[settings[SETTINGS_KEYS.trend]] || TREND_LABELS.neutral;
      trendElement.textContent = label;
    }
  }

  function describeField(field) {
    if (!field) {
      return 'Not set';
    }

    const parts = [];
    if (field.caption) {
      parts.push(field.caption);
    } else if (field.name) {
      parts.push(field.name);
    } else if (field.id) {
      parts.push(field.id);
    }

    if (field.aggregation && field.aggregation.toLowerCase() !== 'none') {
      parts.push(`aggregation: ${field.aggregation}`);
    }

    if (field.dataType) {
      parts.push(`type: ${field.dataType}`);
    }

    if (field.role) {
      parts.push(`role: ${field.role}`);
    }

    return parts.join(' | ');
  }

  function updateEncodingDisplay(encodingMap) {
    if (measureElement) {
      measureElement.textContent = describeField(encodingMap[ENCODING_IDS.measure]);
    }

    if (timeElement) {
      timeElement.textContent = describeField(encodingMap[ENCODING_IDS.time]);
    }

    if (!encodingMap[ENCODING_IDS.measure] || !encodingMap[ENCODING_IDS.time]) {
      setStatus('Drop a measure and a date field onto the extension marks card.');
    } else {
      setStatus('Extension ready. Use Format Extension to adjust options.');
    }
  }

  function extractEncodingMap(visualSpec) {
    const map = {};
    if (!visualSpec || visualSpec.activeMarksSpecificationIndex < 0) {
      return map;
    }

    const marksCard = visualSpec.marksSpecifications[visualSpec.activeMarksSpecificationIndex];
    if (!marksCard || !marksCard.encodings) {
      return map;
    }

    marksCard.encodings.forEach((encoding) => {
      map[encoding.id] = encoding.field;
    });

    return map;
  }

  function refreshEncodingInfo() {
    if (!worksheet) {
      return;
    }

    worksheet
      .getVisualSpecificationAsync()
      .then((visualSpec) => {
        const encodingMap = extractEncodingMap(visualSpec);
        updateEncodingDisplay(encodingMap);
      })
      .catch((error) => {
        console.error('[Extension] Failed to load encodings', error);
        setStatus('Unable to read current field mapping.');
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
        if (error.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          setStatus('Configuration dialog dismissed.');
          return;
        }
        handleError(error);
      });
  }

  function registerEventListeners() {
    const settings = tableau.extensions.settings;
    settings.addEventListener(tableau.TableauEventType.SettingsChanged, () => {
      applySettingsDisplay(getCurrentSettings());
    });

    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, refreshEncodingInfo);
  }

  function initializeExtension() {
    if (!window.tableau || !tableau.extensions) {
      setStatus('Tableau Extensions API unavailable.');
      return;
    }

    setStatus('Connecting to Tableau...');

    tableau.extensions
      .initializeAsync({ configure: openConfigurationDialog })
      .then(() => {
        worksheet = tableau.extensions.worksheetContent?.worksheet;
        if (!worksheet) {
          setStatus('Unable to resolve worksheet context.');
          return;
        }

        registerEventListeners();
        applySettingsDisplay(getCurrentSettings());
        refreshEncodingInfo();
        setStatus('Extension ready. Use Format Extension to adjust options.');

        if (outputElement && !outputElement.value) {
          outputElement.value = '';
        }
      })
      .catch(handleError);
  }

  function onDomReady() {
    statusElement = document.getElementById('status');
    outputElement = document.getElementById('llmText');
    measureElement = document.getElementById('measureField');
    timeElement = document.getElementById('timeField');
    periodElement = document.getElementById('periodDisplay');
    additiveElement = document.getElementById('additiveDisplay');
    trendElement = document.getElementById('trendDisplay');

    initializeExtension();
  }

  document.addEventListener('DOMContentLoaded', onDomReady);
})();
