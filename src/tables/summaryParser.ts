export interface DataTable {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface SummaryContext {
  summaryTable: DataTable;
  comparisonTable?: DataTable;
  dimensionTables?: Record<string, DataTable>;
  filtersState?: Record<string, unknown>;
}

export async function fetchSummaryContext(): Promise<SummaryContext> {
  const canUseTableau = typeof tableau !== "undefined" && tableau?.extensions;

  if (canUseTableau) {
    try {
      await tableau.extensions.initializeAsync();
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      const worksheets = dashboard.worksheets;
      const primaryWorksheet = worksheets?.length ? worksheets[0] : null;

      if (!primaryWorksheet) {
        throw new Error("No worksheet available in dashboard");
      }

      const summary = await primaryWorksheet.getSummaryDataAsync({ ignoreSelection: false });
      const summaryTable = convertDataTable(summary);

      const dimensionTables: Record<string, DataTable> = {};
      // Grab top-level categorical columns for quick factor breakdowns.
      summary.columns
        .filter((col: any) => col?.dataType === "string")
        .slice(0, 3)
        .forEach((col: any) => {
          const alias = col?.fieldName ?? col?.columnName ?? "dimension";
          dimensionTables[alias] = pivotByDimension(summaryTable, alias);
        });

      const filtersState = await collectFilters(worksheets);

      return {
        summaryTable,
        dimensionTables,
        filtersState,
      };
    } catch (error) {
      console.warn("Failed to load Tableau summary data", error);
    }
  }

  return getFallbackContext();
}

function convertDataTable(data: any): DataTable {
  const columns: string[] = data.columns?.map((col: any) => col?.fieldName ?? col?.columnName ?? String(col?.index)) ?? [];
  const rows = (data.data ?? []).map((cells: any[]) => {
    const record: Record<string, string | number | null> = {};
    cells.forEach((cell: any, idx: number) => {
      const columnName = columns[idx] ?? `col_${idx}`;
      record[columnName] = cell?.formattedValue ?? cell?.value ?? null;
    });
    return record;
  });
  return { columns, rows };
}

async function collectFilters(worksheets: any[]): Promise<Record<string, unknown>> {
  const filterState: Record<string, unknown> = {};
  if (!Array.isArray(worksheets)) {
    return filterState;
  }

  for (const sheet of worksheets) {
    try {
      const filters = await sheet.getFiltersAsync();
      filterState[sheet.name] = filters.map((filter: any) => ({
        fieldName: filter?.fieldName,
        filterType: filter?.filterType,
        values: filter?.appliedValues?.map((val: any) => val?.value),
      }));
    } catch (error) {
      console.debug(`Unable to fetch filters for sheet ${sheet?.name}`, error);
    }
  }

  return filterState;
}

function pivotByDimension(table: DataTable, column: string): DataTable {
  if (!table.columns.includes(column)) {
    return table;
  }

  const aggregates = new Map<string, { count: number }>();

  for (const row of table.rows) {
    const key = String(row[column] ?? "(null)");
    const bucket = aggregates.get(key) ?? { count: 0 };
    bucket.count += 1;
    aggregates.set(key, bucket);
  }

  const rows = Array.from(aggregates.entries()).map(([group, stats]) => ({
    [column]: group,
    count: stats.count,
  }));

  return {
    columns: [column, "count"],
    rows,
  };
}

function getFallbackContext(): SummaryContext {
  const summaryTable: DataTable = {
    columns: ["Order Date", "Region", "Sales"],
    rows: [
      { "Order Date": "2024-07-01", Region: "East", Sales: 1200 },
      { "Order Date": "2024-07-02", Region: "Central", Sales: 980 },
      { "Order Date": "2024-07-03", Region: "West", Sales: 1430 },
    ],
  };

  const dimensionTables = {
    Region: pivotByDimension(summaryTable, "Region"),
  };

  return {
    summaryTable,
    dimensionTables,
    filtersState: { mock: true },
  };
}
