(function () {
  const SETTINGS_KEYS = {
    period: 'period',
    additive: 'isAdditiveMetric',
    trend: 'trendMeaning',
    language: 'summaryLanguage'
  };

  const DEFAULTS = {
    [SETTINGS_KEYS.period]: 'daily',
    [SETTINGS_KEYS.additive]: 'false',
    [SETTINGS_KEYS.trend]: 'neutral',
    [SETTINGS_KEYS.language]: 'en'
  };

  let periodSelect;
  let additiveCheckbox;
  let trendSelect;
  let languageSelect;

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
        [SETTINGS_KEYS.additive]: parsed[SETTINGS_KEYS.additive] || DEFAULTS[SETTINGS_KEYS.additive],
        [SETTINGS_KEYS.trend]: parsed[SETTINGS_KEYS.trend] || DEFAULTS[SETTINGS_KEYS.trend],
        [SETTINGS_KEYS.language]: parsed[SETTINGS_KEYS.language] || DEFAULTS[SETTINGS_KEYS.language]
      };
    } catch (error) {
      console.warn('[Extension][Dialog] Failed to parse payload', error);
      return { ...DEFAULTS };
    }
  }

  function applySettingsToForm(settings) {
    periodSelect.value = settings[SETTINGS_KEYS.period];
    additiveCheckbox.checked = settings[SETTINGS_KEYS.additive] === 'true';
    trendSelect.value = settings[SETTINGS_KEYS.trend];
    languageSelect.value = settings[SETTINGS_KEYS.language];
  }

  function collectFormValues() {
    return {
      [SETTINGS_KEYS.period]: periodSelect.value,
      [SETTINGS_KEYS.additive]: additiveCheckbox.checked ? 'true' : 'false',
      [SETTINGS_KEYS.trend]: trendSelect.value,
      [SETTINGS_KEYS.language]: languageSelect.value
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
    additiveCheckbox = document.getElementById('additiveCheckbox');
    trendSelect = document.getElementById('trendSelect');
    languageSelect = document.getElementById('languageSelect');

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
