import { SETTINGS_KEYS, PERIOD_LABELS, TREND_LABELS, LANGUAGE_OPTIONS } from '../constants.js';

// Period comparison strategy patterns
const COMPARISON_PATTERNS = {
  sequential: 'Compare performance against the immediately preceding period of equal length. Highlight sequential momentum, reversals, or notable shifts.',
  periodToDate: 'Compare progress against the same point in the prior period. Frame results as pacing ahead or behind, and note implications for the remaining time.',
  trendFocused: 'Emphasize directional trends and sustained momentum. Use the rolling window to smooth short-term volatility and surface persistent patterns.'
};

// Map each period type to its comparison pattern
const PERIOD_PATTERN_MAP = {
  // Complete Period → Sequential comparison
  lastDay: 'sequential',
  lastWeek: 'sequential',
  lastMonth: 'sequential',

  // Period to Date → Period-to-date comparison
  wtd: 'periodToDate',
  mtd: 'periodToDate',
  qtd: 'periodToDate',

  // Rolling Window → Trend-focused comparison
  rolling7: 'trendFocused',
  rolling14: 'trendFocused',
  rolling28: 'trendFocused'
};

const PERIOD_GUIDANCE = {
  lastDay: COMPARISON_PATTERNS.sequential,
  lastWeek: COMPARISON_PATTERNS.sequential,
  lastMonth: COMPARISON_PATTERNS.sequential,
  wtd: COMPARISON_PATTERNS.periodToDate,
  mtd: COMPARISON_PATTERNS.periodToDate,
  qtd: COMPARISON_PATTERNS.periodToDate,
  rolling7: COMPARISON_PATTERNS.trendFocused,
  rolling14: COMPARISON_PATTERNS.trendFocused,
  rolling28: COMPARISON_PATTERNS.trendFocused
};

const TREND_GUIDANCE = {
  positive: 'Upward movement is favorable; celebrate increases and treat sustained declines as risks.',
  negative: 'Upward movement is unfavorable; treat increases as warning signs and declines as relief.',
  neutral: 'Trend direction is context dependent; spell out why increases or decreases matter for the business.'
};

const REPORT_SKELETON = [
  {
    id: 'executive-snapshot',
    title: 'Executive Snapshot',
    instruction: 'Deliver the top-line result for the selected period and note the primary directional change in one crisp paragraph.'
  },
  {
    id: 'key-drivers',
    title: 'Key Drivers',
    instruction: 'Highlight the segments, regions, or categories that most influenced the movement, referencing available fields.'
  },
  {
    id: 'risks-watchouts',
    title: 'Risks & Watchouts',
    instruction: 'Call out negative signals, volatility, or data caveats leadership should monitor.'
  },
  {
    id: 'next-actions',
    title: 'Next Actions',
    instruction: 'Recommend immediate follow-ups or decisions enabled by the insight.'
  }
];

function sanitizeFieldDescriptor(descriptor) {
  if (!descriptor) {
    return null;
  }

  const fieldName = descriptor.fieldName || '';
  const displayName = descriptor.displayName || fieldName || '';
  const dataType = descriptor.dataType || '';

  if (!fieldName && !displayName && !dataType) {
    return null;
  }

  return { fieldName, displayName, dataType };
}

export function escapeXmlValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeSettingKey(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).toLowerCase();
}

function describeLanguage(code) {
  const normalized = (code || '').toLowerCase();
  const language = LANGUAGE_OPTIONS[normalized] || LANGUAGE_OPTIONS.en;

  return {
    code: language.code,
    label: language.label,
    guidance: language.guidance
  };
}

function describePeriod(code) {
  const normalized = normalizeSettingKey(code);
  const label = PERIOD_LABELS[normalized] || 'Custom cadence';
  const guidance = PERIOD_GUIDANCE[normalized] || 'Describe how the selected cadence shapes comparisons and trend commentary.';

  return { code: normalized, label, guidance };
}

function describeTrend(code) {
  const normalized = normalizeSettingKey(code);
  const label = TREND_LABELS[normalized] || 'Neutral';
  const guidance = TREND_GUIDANCE[normalized] || 'Explain why increases or decreases matter for stakeholders.';

  return { code: normalized, label, guidance };
}

export function buildSettingsReferenceXml(settings, summaryMetadata = {}) {
  if (!settings) {
    return '<extensionSettings />';
  }

  const periodInfo = describePeriod(settings[SETTINGS_KEYS.period]);
  const trendInfo = describeTrend(settings[SETTINGS_KEYS.trend]);
  const languageInfo = describeLanguage(settings[SETTINGS_KEYS.language]);

  const measureInfo = sanitizeFieldDescriptor(summaryMetadata.measure);
  const dateInfo = sanitizeFieldDescriptor(summaryMetadata.date);
  const detailColumns = Array.isArray(summaryMetadata.detail)
    ? summaryMetadata.detail.map(sanitizeFieldDescriptor).filter(Boolean)
    : [];

  const lines = [
    '<extensionSettings>',
    `  <period code="${escapeXmlValue(periodInfo.code)}" label="${escapeXmlValue(periodInfo.label)}">`,
    `    <guidance>${escapeXmlValue(periodInfo.guidance)}</guidance>`,
    '  </period>',
    `  <trendMeaning code="${escapeXmlValue(trendInfo.code)}" label="${escapeXmlValue(trendInfo.label)}">`,
    `    <guidance>${escapeXmlValue(trendInfo.guidance)}</guidance>`,
    '  </trendMeaning>',
    `  <language code="${escapeXmlValue(languageInfo.code)}" label="${escapeXmlValue(languageInfo.label)}">`,
    `    <guidance>${escapeXmlValue(languageInfo.guidance)}</guidance>`,
    '  </language>'
  ];

  if (measureInfo || dateInfo) {
    lines.push('  <primaryFields>');
    if (dateInfo) {
      lines.push(
        `    <dateField name="${escapeXmlValue(dateInfo.fieldName)}" label="${escapeXmlValue(dateInfo.displayName)}" dataType="${escapeXmlValue(dateInfo.dataType)}" />`
      );
    }
    if (measureInfo) {
      lines.push(
        `    <measureField name="${escapeXmlValue(measureInfo.fieldName)}" label="${escapeXmlValue(measureInfo.displayName)}" dataType="${escapeXmlValue(measureInfo.dataType)}" />`
      );
    }
    lines.push('  </primaryFields>');
  }

  if (detailColumns.length > 0) {
    lines.push(`  <detailFields count="${detailColumns.length}">`);
    detailColumns.forEach((detail) => {
      lines.push(
        `    <field name="${escapeXmlValue(detail.fieldName)}" label="${escapeXmlValue(detail.displayName)}" dataType="${escapeXmlValue(detail.dataType)}" />`
      );
    });
    lines.push('  </detailFields>');
  }

  lines.push('  <reportSkeleton>');
  REPORT_SKELETON.forEach((section) => {
    lines.push(
      `    <section id="${escapeXmlValue(section.id)}" title="${escapeXmlValue(section.title)}">${escapeXmlValue(section.instruction)}</section>`
    );
  });
  lines.push('  </reportSkeleton>');
  lines.push('  <usageNotes>Use cadence, metric interpretation, trend guidance, and key fields to ground the narrative when relevant without listing them verbatim or naming internal labels.</usageNotes>');
  lines.push('</extensionSettings>');

  return lines.join('');
}

