import { SETTINGS_KEYS } from '../constants.js';

export function escapeXmlValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSettingsReferenceXml(settings) {
  if (!settings) {
    return '<settings />';
  }

  const period = escapeXmlValue(settings[SETTINGS_KEYS.period]);
  const additive = escapeXmlValue(settings[SETTINGS_KEYS.additive]);
  const trend = escapeXmlValue(settings[SETTINGS_KEYS.trend]);

  return '<extensionSettings><period>' + period + '</period><isAdditive>' + additive + '</isAdditive><trend>' + trend + '</trend></extensionSettings>';
}
