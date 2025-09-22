import { ControlValues } from "../ui/controls";
import { DataTable, SummaryContext } from "../tables/summaryParser";

export interface PromptRequestPayload {
  prompt: string;
  parameters: ControlValues;
  tables: SummaryTablesPayload;
}

export interface SummaryTablesPayload {
  summary: DataTable;
  comparison?: DataTable;
  dimensions?: Record<string, DataTable>;
  filtersState?: Record<string, unknown>;
}

const promptCache = new Map<string, string>();

export async function buildPromptPayload(options: {
  controls: ControlValues;
  data: SummaryContext;
  promptPath?: string;
}): Promise<PromptRequestPayload> {
  const { controls, data } = options;
  const basePrompt = await getBasePrompt(options.promptPath);

  const replacements: Record<string, string> = {
    aggregation_period: fallback(controls.aggregationPeriod, "Not specified"),
    comparison_period: fallback(controls.comparisonPeriod, "Not specified"),
    comparison_span: fallback(controls.comparisonSpan, "Not specified"),
    improvement_direction: controls.improvementDirection,
    dimension_breakdown_required: String(controls.dimensionBreakdownRequired),
    trend_detection_required: String(controls.trendDetectionRequired),
    user_prompt: controls.userPrompt || "",
    summary_table: serializeTable(data.summaryTable),
    comparison_table: serializeTable(data.comparisonTable),
    dimension_tables: serializeDimensionTables(data.dimensionTables),
    filters_state: JSON.stringify(data.filtersState ?? {}, null, 2),
  };

  let hydratedPrompt = basePrompt;
  for (const [token, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{${token}}}`, "g");
    hydratedPrompt = hydratedPrompt.replace(pattern, value);
  }

  return {
    prompt: hydratedPrompt,
    parameters: controls,
    tables: {
      summary: data.summaryTable,
      comparison: data.comparisonTable,
      dimensions: data.dimensionTables,
      filtersState: data.filtersState,
    },
  };
}

async function getBasePrompt(path = "config/base_prompt.xml"): Promise<string> {
  if (promptCache.has(path)) {
    return promptCache.get(path)!;
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load base prompt from ${path} (${response.status})`);
  }
  const text = await response.text();
  promptCache.set(path, text);
  return text;
}

function fallback(value: string | undefined, fallbackValue: string): string {
  return value && value.trim().length > 0 ? value : fallbackValue;
}

function serializeTable(table?: DataTable): string {
  if (!table) {
    return "";
  }
  return JSON.stringify({ columns: table.columns, rows: table.rows }, null, 2);
}

function serializeDimensionTables(tables?: Record<string, DataTable>): string {
  if (!tables || Object.keys(tables).length === 0) {
    return "{}";
  }
  const rendered: Record<string, unknown> = {};
  for (const [key, table] of Object.entries(tables)) {
    rendered[key] = {
      columns: table.columns,
      rows: table.rows,
    };
  }
  return JSON.stringify(rendered, null, 2);
}
