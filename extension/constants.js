export const SETTINGS_KEYS = {
  period: 'period',
  additive: 'isAdditiveMetric',
  trend: 'trendMeaning',
  language: 'summaryLanguage'
};

export const DEFAULT_SETTINGS = {
  [SETTINGS_KEYS.period]: 'daily',
  [SETTINGS_KEYS.additive]: 'false',
  [SETTINGS_KEYS.trend]: 'neutral',
  [SETTINGS_KEYS.language]: 'en'
};

export const PERIOD_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly'
};

export const TREND_LABELS = {
  positive: 'Good (up is positive)',
  negative: 'Bad (up is negative)',
  neutral: 'Neutral'
};

export const LANGUAGE_OPTIONS = {
  en: { code: 'en', label: 'English', guidance: 'Respond using clear, professional English.' },
  ja: { code: 'ja', label: 'Japanese', guidance: 'Respond using natural, executive-level Japanese with formal tone.' }
};

export const ENCODING_IDS = {
  measure: 'measure',
  time: 'time'
};

export const SUMMARY_CSV_FILENAME = 'summary_data.csv';
