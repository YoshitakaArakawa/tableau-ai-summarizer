import { calculateDateRange, getPeriodMetadata, getYesterday } from '../utils/dateCalculator.js';

/**
 * Apply date filter to worksheet based on period settings
 * @param {object} worksheet - Tableau worksheet object
 * @param {string} dateFieldName - Name of the date field to filter
 * @param {string} periodType - Period type (wtd, mtd, qtd, etc.)
 * @param {string} timezone - Timezone ('UTC' or 'JST')
 * @returns {Promise<void>}
 */
export async function applyDateFilter(worksheet, dateFieldName, periodType, timezone = 'UTC') {
  if (!worksheet || !dateFieldName || !periodType) {
    throw new Error('Missing required parameters for date filter');
  }

  const metadata = getPeriodMetadata(periodType);

  if (!metadata) {
    throw new Error(`Unknown period type: ${periodType}`);
  }

  const yesterday = getYesterday(timezone);

  try {
    if (metadata.useRelativeDate) {
      // Use relative date filter API
      const options = {
        anchorDate: yesterday,
        periodType: metadata.periodType,
        rangeType: metadata.rangeType
      };

      if (metadata.rangeN !== undefined) {
        options.rangeN = metadata.rangeN;
      }

      await worksheet.applyRelativeDateFilterAsync(dateFieldName, options);
      console.log(`[DateFilter] Applied relative date filter: ${periodType}`, options);
    } else {
      // Use range filter with calculated dates
      const { min, max } = calculateDateRange(periodType, timezone);

      await worksheet.applyRangeFilterAsync(dateFieldName, {
        min,
        max
      });
      console.log(`[DateFilter] Applied range filter: ${periodType}`, { min, max });
    }
  } catch (error) {
    console.error('[DateFilter] Failed to apply filter', error);
    throw new Error(`Failed to apply ${periodType} filter: ${error.message}`);
  }
}

/**
 * Clear date filter from worksheet
 * @param {object} worksheet - Tableau worksheet object
 * @param {string} dateFieldName - Name of the date field
 * @returns {Promise<void>}
 */
export async function clearDateFilter(worksheet, dateFieldName) {
  if (!worksheet || !dateFieldName) {
    return;
  }

  try {
    await worksheet.clearFilterAsync(dateFieldName);
    console.log(`[DateFilter] Cleared filter on ${dateFieldName}`);
  } catch (error) {
    console.warn('[DateFilter] Failed to clear filter', error);
  }
}
