(function () {
  const SETTINGS_KEYS = {
    period: 'period',
    trend: 'trendMeaning',
    language: 'summaryLanguage',
    cumulative: 'isCumulative',
    timezone: 'timezone'
  };

  const DEFAULTS = {
    [SETTINGS_KEYS.period]: 'wtd',
    [SETTINGS_KEYS.trend]: 'neutral',
    [SETTINGS_KEYS.language]: 'en',
    [SETTINGS_KEYS.cumulative]: 'false',
    [SETTINGS_KEYS.timezone]: 'UTC'
  };

  let periodSelect;
  let trendSelect;
  let languageSelect;
  let cumulativeCheckbox;
  let timezoneSelect;

  function closeDialogWith(message) {
    tableau.extensions.ui.closeDialog(message || 'Configuration dialog closed.');
  }

  function handleError(error) {
    console.error('[Extension][Dialog] Error', error);
    closeDialogWith('Configuration failed.');
  }

  function parsePayload(payload) {
    if (!payload) {
      return { ...DEFAULTS };
    }

    try {
      const parsed = JSON.parse(payload);
      return {
        [SETTINGS_KEYS.period]: parsed[SETTINGS_KEYS.period] || DEFAULTS[SETTINGS_KEYS.period],
        [SETTINGS_KEYS.trend]: parsed[SETTINGS_KEYS.trend] || DEFAULTS[SETTINGS_KEYS.trend],
        [SETTINGS_KEYS.language]: parsed[SETTINGS_KEYS.language] || DEFAULTS[SETTINGS_KEYS.language],
        [SETTINGS_KEYS.cumulative]: parsed[SETTINGS_KEYS.cumulative] || DEFAULTS[SETTINGS_KEYS.cumulative],
        [SETTINGS_KEYS.timezone]: parsed[SETTINGS_KEYS.timezone] || DEFAULTS[SETTINGS_KEYS.timezone]
      };
    } catch (error) {
      console.warn('[Extension][Dialog] Failed to parse payload', error);
      return { ...DEFAULTS };
    }
  }

  function applySettingsToForm(settings) {
    periodSelect.value = settings[SETTINGS_KEYS.period];
    trendSelect.value = settings[SETTINGS_KEYS.trend];
    languageSelect.value = settings[SETTINGS_KEYS.language];
    cumulativeCheckbox.checked = settings[SETTINGS_KEYS.cumulative] === 'true';
    timezoneSelect.value = settings[SETTINGS_KEYS.timezone];
  }

  function collectFormValues() {
    return {
      [SETTINGS_KEYS.period]: periodSelect.value,
      [SETTINGS_KEYS.trend]: trendSelect.value,
      [SETTINGS_KEYS.language]: languageSelect.value,
      [SETTINGS_KEYS.cumulative]: cumulativeCheckbox.checked ? 'true' : 'false',
      [SETTINGS_KEYS.timezone]: timezoneSelect.value
    };
  }

  function saveSettings(values) {
    const settings = tableau.extensions.settings;
    Object.entries(values).forEach(([key, value]) => settings.set(key, value));

    return settings
      .saveAsync()
      .then(() => closeDialogWith('Configuration saved.'))
      .catch(handleError);
  }

  function onSave() {
    const values = collectFormValues();
    saveSettings(values);
  }

  function onCancel() {
    closeDialogWith('Configuration dialog dismissed.');
  }

  function onReady() {
    periodSelect = document.getElementById('periodSelect');
    trendSelect = document.getElementById('trendSelect');
    languageSelect = document.getElementById('languageSelect');
    cumulativeCheckbox = document.getElementById('cumulativeCheckbox');
    timezoneSelect = document.getElementById('timezoneSelect');

    document.getElementById('saveDialog').addEventListener('click', onSave);
    document.getElementById('cancelDialog').addEventListener('click', onCancel);

    tableau.extensions
      .initializeDialogAsync()
      .then((openPayload) => {
        const initialSettings = parsePayload(openPayload);
        applySettingsToForm(initialSettings);
      })
      .catch(handleError);
  }

  document.addEventListener('DOMContentLoaded', onReady);
})();
