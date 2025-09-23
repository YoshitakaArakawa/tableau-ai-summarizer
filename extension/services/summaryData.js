import { dataTableToCsv } from '../helpers/csv.js';

export function fetchSummaryDataCsv(worksheet) {
  if (!worksheet) {
    return Promise.reject(new Error('Worksheet context unavailable.'));
  }

  return worksheet
    .getSummaryDataAsync({ maxRows: 0, ignoreSelection: true })
    .then((dataTable) => {
      if (!dataTable || !Array.isArray(dataTable.data)) {
        throw new Error('Summary data unavailable.');
      }

      return dataTableToCsv(dataTable);
    });
}
