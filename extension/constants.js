export const SETTINGS_KEYS = {
  period: 'period',
  trend: 'trendMeaning',
  language: 'summaryLanguage',
  cumulative: 'isCumulative',
  timezone: 'timezone'
};

export const DEFAULT_SETTINGS = {
  [SETTINGS_KEYS.period]: 'wtd',
  [SETTINGS_KEYS.trend]: 'neutral',
  [SETTINGS_KEYS.language]: 'en',
  [SETTINGS_KEYS.cumulative]: 'false',
  [SETTINGS_KEYS.timezone]: 'UTC'
};

export const PERIOD_CATEGORIES = {
  periodToDate: {
    label: 'Period to Date',
    options: {
      wtd: 'Week to Date (WTD)',
      mtd: 'Month to Date (MTD)',
      qtd: 'Quarter to Date (QTD)'
    }
  },
  completePeriod: {
    label: 'Complete Period',
    options: {
      lastDay: 'Last Day',
      lastWeek: 'Last Week',
      lastMonth: 'Last Month'
    }
  },
  rollingWindow: {
    label: 'Rolling Window',
    options: {
      rolling7: 'Rolling 7 Days',
      rolling14: 'Rolling 14 Days',
      rolling28: 'Rolling 28 Days'
    }
  }
};

export const PERIOD_LABELS = {
  wtd: 'Week to Date (WTD)',
  mtd: 'Month to Date (MTD)',
  qtd: 'Quarter to Date (QTD)',
  lastDay: 'Last Day',
  lastWeek: 'Last Week',
  lastMonth: 'Last Month',
  rolling7: 'Rolling 7 Days',
  rolling14: 'Rolling 14 Days',
  rolling28: 'Rolling 28 Days'
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

export const TIMEZONE_OPTIONS = {
  UTC: { code: 'UTC', label: 'UTC', offset: 0 },
  JST: { code: 'JST', label: 'JST (UTC+9)', offset: 9 }
};

export const ENCODING_IDS = {
  measure: 'measure',
  time: 'time'
};

export const SUMMARY_CSV_FILENAME = 'summary_data.csv';
