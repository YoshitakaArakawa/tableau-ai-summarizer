function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\r') ||
    stringValue.includes('\n')
  ) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }

  return stringValue;
}

function extractCellValue(cell) {
  if (cell === null || cell === undefined) {
    return '';
  }

  if (typeof cell === 'object') {
    if (Object.prototype.hasOwnProperty.call(cell, 'formattedValue')) {
      if (cell.formattedValue != null) {
        return cell.formattedValue;
      }

      if (Object.prototype.hasOwnProperty.call(cell, 'value')) {
        return cell.value == null ? '' : cell.value;
      }

      return '';
    }

    if (Object.prototype.hasOwnProperty.call(cell, 'value')) {
      return cell.value == null ? '' : cell.value;
    }

    if (Object.prototype.hasOwnProperty.call(cell, 'formatted')) {
      return cell.formatted == null ? '' : cell.formatted;
    }

    try {
      return JSON.stringify(cell);
    } catch (_error) {
      return String(cell);
    }
  }

  return cell;
}

function sanitizeCsvHeader(column, index) {
  if (!column) {
    return 'Column_' + (index + 1);
  }

  return (
    column.fieldName ||
    column.displayName ||
    column.columnName ||
    column.caption ||
    'Column_' + (index + 1)
  );
}

export function dataTableToCsv(dataTable) {
  const headerLine = (dataTable.columns || [])
    .map((column, index) => escapeCsvValue(sanitizeCsvHeader(column, index)))
    .join(',');

  const rowLines = (dataTable.data || []).map((row) =>
    row.map((cell) => escapeCsvValue(extractCellValue(cell))).join(',')
  );

  return [headerLine, ...rowLines].join('\r\n');
}
