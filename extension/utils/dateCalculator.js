/**
 * Date calculation utilities for period filters
 * Week start: Monday (fixed)
 * Quarter start: January (fixed)
 */

/**
 * Get yesterday's date in the specified timezone
 * @param {string} timezone - 'UTC' or 'JST'
 * @returns {Date} UTC Date object representing yesterday
 */
export function getYesterday(timezone = 'UTC') {
  const now = new Date();
  const offset = timezone === 'JST' ? 9 : 0;

  // Get current time in the specified timezone
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const tzTime = new Date(utcTime + (offset * 3600000));

  // Subtract one day
  tzTime.setDate(tzTime.getDate() - 1);

  // Return as UTC date
  return new Date(Date.UTC(
    tzTime.getFullYear(),
    tzTime.getMonth(),
    tzTime.getDate()
  ));
}

/**
 * Get the start of the week (Monday) for a given date
 * @param {Date} date - Input date
 * @returns {Date} Start of week (Monday)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Get the start of the month for a given date
 * @param {Date} date - Input date
 * @returns {Date} Start of month
 */
function getMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Get the start of the quarter for a given date (January start)
 * @param {Date} date - Input date
 * @returns {Date} Start of quarter
 */
function getQuarterStart(date) {
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

/**
 * Calculate date range based on period type
 * @param {string} periodType - Period type (wtd, mtd, qtd, lastDay, lastWeek, lastMonth, rolling7, rolling14, rolling28)
 * @param {string} timezone - Timezone ('UTC' or 'JST')
 * @returns {{min: Date, max: Date}} Date range for the filter
 */
export function calculateDateRange(periodType, timezone = 'UTC') {
  const yesterday = getYesterday(timezone);

  switch (periodType) {
    // Period to Date
    case 'wtd': {
      // Get this week's start (Monday)
      const thisWeekStart = getWeekStart(yesterday);
      // Go back 7 days to get last week's Monday
      const twoWeeksAgoStart = new Date(thisWeekStart);
      twoWeeksAgoStart.setUTCDate(thisWeekStart.getUTCDate() - 7);
      return {
        min: twoWeeksAgoStart,
        max: yesterday
      };
    }

    case 'mtd': {
      // Get last month's first day
      const thisMonthStart = getMonthStart(yesterday);
      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setUTCDate(thisMonthStart.getUTCDate() - 1);
      const lastMonthStart = getMonthStart(lastMonthEnd);
      return {
        min: lastMonthStart,
        max: yesterday
      };
    }

    case 'qtd': {
      // Get last quarter's first day
      const thisQuarterStart = getQuarterStart(yesterday);
      const lastQuarterEnd = new Date(thisQuarterStart);
      lastQuarterEnd.setUTCDate(thisQuarterStart.getUTCDate() - 1);
      const lastQuarterStart = getQuarterStart(lastQuarterEnd);
      return {
        min: lastQuarterStart,
        max: yesterday
      };
    }

    // Complete Period
    case 'lastDay': {
      // Last 7 days including yesterday
      const start = new Date(yesterday);
      start.setUTCDate(start.getUTCDate() - 6);
      return {
        min: start,
        max: yesterday
      };
    }

    case 'lastWeek': {
      // Get this week's start (Monday)
      const thisWeekStart = getWeekStart(yesterday);
      // Go back 14 days to get two weeks ago Monday
      const twoWeeksAgoStart = new Date(thisWeekStart);
      twoWeeksAgoStart.setUTCDate(thisWeekStart.getUTCDate() - 14);
      // Last week's Sunday = this week's Monday - 1 day
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setUTCDate(thisWeekStart.getUTCDate() - 1);
      return {
        min: twoWeeksAgoStart,
        max: lastWeekEnd
      };
    }

    case 'lastMonth': {
      // Get this month's first day
      const thisMonthStart = getMonthStart(yesterday);
      // Go back 1 day to get last month's last day
      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setUTCDate(thisMonthStart.getUTCDate() - 1);
      // Get last month's first day
      const lastMonthStart = getMonthStart(lastMonthEnd);
      // Go back to get two months ago first day
      const twoMonthsAgoEnd = new Date(lastMonthStart);
      twoMonthsAgoEnd.setUTCDate(lastMonthStart.getUTCDate() - 1);
      const twoMonthsAgoStart = getMonthStart(twoMonthsAgoEnd);
      return {
        min: twoMonthsAgoStart,
        max: lastMonthEnd
      };
    }

    // Rolling Window
    case 'rolling7': {
      const start = new Date(yesterday);
      start.setUTCDate(start.getUTCDate() - 13);
      return {
        min: start,
        max: yesterday
      };
    }

    case 'rolling14': {
      const start = new Date(yesterday);
      start.setUTCDate(start.getUTCDate() - 27);
      return {
        min: start,
        max: yesterday
      };
    }

    case 'rolling28': {
      const start = new Date(yesterday);
      start.setUTCDate(start.getUTCDate() - 55);
      return {
        min: start,
        max: yesterday
      };
    }

    default:
      throw new Error(`Unknown period type: ${periodType}`);
  }
}

/**
 * Get period metadata for Tableau API
 * @param {string} periodType - Period type
 * @returns {{useRelativeDate: boolean, periodType?: string, rangeType?: string, rangeN?: number} | null}
 */
export function getPeriodMetadata(periodType) {
  const relativeMapping = {
    // Period to Date - use range filter (calculated dates)
    wtd: { useRelativeDate: false },
    mtd: { useRelativeDate: false },
    qtd: { useRelativeDate: false },

    // Complete Period - use range filter (calculated dates)
    lastDay: { useRelativeDate: false },
    lastWeek: { useRelativeDate: false },
    lastMonth: { useRelativeDate: false },

    // Rolling Window - use relative date API
    rolling7: { useRelativeDate: true, periodType: 'Days', rangeType: 'LastN', rangeN: 7 },
    rolling14: { useRelativeDate: true, periodType: 'Days', rangeType: 'LastN', rangeN: 14 },
    rolling28: { useRelativeDate: true, periodType: 'Days', rangeType: 'LastN', rangeN: 28 }
  };

  return relativeMapping[periodType] || null;
}
