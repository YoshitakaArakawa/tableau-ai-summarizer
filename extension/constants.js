export const SETTINGS_KEYS = {
  period: 'period',
  additive: 'isAdditiveMetric',
  trend: 'trendMeaning'
};

export const DEFAULT_SETTINGS = {
  [SETTINGS_KEYS.period]: 'daily',
  [SETTINGS_KEYS.additive]: 'false',
  [SETTINGS_KEYS.trend]: 'neutral'
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

export const ENCODING_IDS = {
  measure: 'measure',
  time: 'time'
};

export const SUMMARY_CSV_FILENAME = 'summary_data.csv';
