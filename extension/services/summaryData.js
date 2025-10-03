import { dataTableToCsv } from '../helpers/csv.js';

function canonicalizeName(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeColumnLabel(column, index) {
  const fieldName = column?.fieldName || column?.columnName || '';
  const displayName = column?.displayName || column?.caption || fieldName || 'Column_' + (index + 1);
  const columnName = column?.columnName || '';
  const caption = column?.caption || '';
  const dataType = (column?.dataType || '').toLowerCase();
  const isMeasure = Boolean(column?.isMeasure);
  const isDimension = Boolean(column?.isDimension);
  const isTotalMeasure = Boolean(column?.isTotalMeasure);
  const isPercent = Boolean(column?.isPercent);

  const canonicalNames = [
    fieldName,
    displayName,
    columnName,
    caption
  ]
    .map(canonicalizeName)
    .filter(Boolean);

  return {
    fieldName: fieldName || displayName,
    displayName,
    columnName,
    caption,
    dataType,
    isMeasure,
    isDimension,
    isTotalMeasure,
    isPercent,
    canonicalNames,
    original: column
  };
}

function summarizeColumn(column) {
  if (!column) {
    return null;
  }

  return {
    fieldName: column.fieldName,
    displayName: column.displayName,
    dataType: column.dataType
  };
}

function sanitizeExpectedDetail(detail) {
  if (!detail) {
    return null;
  }

  const fieldName = detail.fieldName || detail.name || '';
  const displayName = detail.displayName || detail.caption || detail.alias || fieldName;
  const dataType = (detail.dataType || detail.fieldType || '').toString().toLowerCase();

  if (!fieldName && !displayName) {
    return null;
  }

  return {
    fieldName: fieldName || displayName,
    displayName,
    dataType
  };
}

function formatEncodingLabel(encodingField, fallbackLabel) {
  if (!encodingField) {
    return fallbackLabel;
  }

  return (
    encodingField.displayName ||
    encodingField.fieldName ||
    encodingField.name ||
    encodingField.caption ||
    fallbackLabel
  );
}

function matchesEncodingField(column, encodingField) {
  if (!encodingField) {
    return false;
  }

  const candidateNames = [
    encodingField.fieldName,
    encodingField.displayName,
    encodingField.name,
    encodingField.caption,
    encodingField.alias
  ]
    .map(canonicalizeName)
    .filter(Boolean);

  if (!candidateNames.length) {
    return false;
  }

  return column.canonicalNames.some((name) => candidateNames.includes(name));
}

function analyseSummaryColumns(columns = [], expectedEncodings = {}) {
  const normalizedColumns = columns.map((column, index) => normalizeColumnLabel(column, index));

  const expectedMeasure = expectedEncodings?.measure;
  const expectedDate = expectedEncodings?.date;

  const measureColumn = (() => {
    if (expectedMeasure) {
      const match = normalizedColumns.find((column) => matchesEncodingField(column, expectedMeasure));
      if (!match) {
        const label = formatEncodingLabel(expectedMeasure, 'the Measure field');
        throw new Error(`Unable to locate the field assigned to the Measure slot (${label}) in the worksheet summary data.`);
      }
      return match;
    }

    const numericCandidates = normalizedColumns.filter((column) => {
      const type = column.dataType;
      return (
        column.isMeasure ||
        /percent/.test(type) ||
        /int|real|float|double|number|decimal/.test(type)
      );
    });

    return numericCandidates.length === 1 ? numericCandidates[0] : null;
  })();

  if (!measureColumn) {
    throw new Error('Summary data is missing a usable measure column. Ensure exactly one numeric field is assigned to the Measure slot.');
  }

  const dateColumn = (() => {
    if (expectedDate) {
      const match = normalizedColumns.find((column) => matchesEncodingField(column, expectedDate));
      if (!match) {
        const label = formatEncodingLabel(expectedDate, 'the Date field');
        throw new Error(`Unable to locate the field assigned to the Date slot (${label}) in the worksheet summary data.`);
      }
      return match;
    }

    const dateCandidates = normalizedColumns.filter((column) => /date|time/.test(column.dataType));
    return dateCandidates.length === 1 ? dateCandidates[0] : null;
  })();

  if (!dateColumn) {
    throw new Error('Summary data is missing a usable date column. Ensure exactly one temporal field is assigned to the Date slot.');
  }

  const detailColumns = normalizedColumns.filter((column) => column !== measureColumn && column !== dateColumn);
  const detailMap = new Map();

  detailColumns.forEach((column) => {
    const summary = summarizeColumn(column);
    const key = canonicalizeName(summary.fieldName || summary.displayName);
    detailMap.set(key, summary);
  });

  if (Array.isArray(expectedEncodings?.detail)) {
    expectedEncodings.detail
      .map(sanitizeExpectedDetail)
      .filter(Boolean)
      .forEach((detail) => {
        const key = canonicalizeName(detail.fieldName || detail.displayName);
        if (!detailMap.has(key)) {
          detailMap.set(key, detail);
        }
      });
  }

  return {
    measure: summarizeColumn(measureColumn),
    date: summarizeColumn(dateColumn),
    detail: Array.from(detailMap.values())
  };
}

export function fetchSummaryDataCsv(worksheet, expectedEncodings = {}) {
  if (!worksheet) {
    return Promise.reject(new Error('Worksheet context unavailable.'));
  }

  return worksheet
    .getSummaryDataAsync({ maxRows: 0, ignoreSelection: true })
    .then((dataTable) => {
      if (!dataTable || !Array.isArray(dataTable.data)) {
        throw new Error('Summary data unavailable.');
      }

      const summaryMetadata = analyseSummaryColumns(dataTable.columns || [], expectedEncodings);
      const csvText = dataTableToCsv(dataTable);
      const chartData = extractChartData(dataTable, summaryMetadata);

      return { csvText, summaryMetadata, chartData };
    });
}

function extractChartData(dataTable, summaryMetadata) {
  if (!dataTable || !dataTable.data || !dataTable.columns) {
    return [];
  }

  const measureName = summaryMetadata?.measure?.fieldName || summaryMetadata?.measure?.displayName || '';
  const dateName = summaryMetadata?.date?.fieldName || summaryMetadata?.date?.displayName || '';

  const measureColIndex = dataTable.columns.findIndex(col => {
    const colName = col?.fieldName || col?.displayName || '';
    return canonicalizeName(colName) === canonicalizeName(measureName);
  });

  const dateColIndex = dataTable.columns.findIndex(col => {
    const colName = col?.fieldName || col?.displayName || '';
    return canonicalizeName(colName) === canonicalizeName(dateName);
  });

  if (measureColIndex === -1 || dateColIndex === -1) {
    return [];
  }

  const aggregationMap = new Map();

  dataTable.data.forEach(row => {
    const rawDate = row[dateColIndex]?.value;
    const formattedDate = row[dateColIndex]?.formattedValue || rawDate || '';
    const measureValue = parseFloat(row[measureColIndex]?.value) || 0;

    const dateKey = String(rawDate || formattedDate);

    if (aggregationMap.has(dateKey)) {
      const existing = aggregationMap.get(dateKey);
      existing.value += measureValue;
    } else {
      aggregationMap.set(dateKey, {
        rawDate: rawDate,
        label: formattedDate,
        value: measureValue
      });
    }
  });

  const chartData = Array.from(aggregationMap.values());

  chartData.sort((a, b) => {
    const dateA = new Date(a.rawDate);
    const dateB = new Date(b.rawDate);

    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      return 0;
    }

    return dateA - dateB;
  });

  return chartData;
}
