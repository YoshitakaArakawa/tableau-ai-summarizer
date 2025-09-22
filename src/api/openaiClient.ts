import { PromptRequestPayload } from "../prompt/payloadBuilder";

export interface InsightMetric {
  name: string;
  current_value: string;
  comparison_value: string | null;
  absolute_delta: string | null;
  percent_change: string | null;
  is_improvement: boolean | null;
}

export interface InsightDriver {
  dimension: string;
  member: string;
  insight: string;
}

export interface TrendAlert {
  description: string;
  detected_on: string | null;
}

export interface InsightResponse {
  headline: string;
  summary: string;
  metrics: InsightMetric[];
  drivers: InsightDriver[];
  trend_alerts: TrendAlert[];
  confidence: {
    level: "high" | "medium" | "low";
    reasons: string;
  };
  diagnostics: string | null;
}

export interface OpenAIClientOptions {
  endpoint?: string;
  apiKey?: string;
  mockResponse?: boolean;
}

export class OpenAIClient {
  constructor(private readonly options: OpenAIClientOptions = {}) {}

  async generateInsights(payload: PromptRequestPayload): Promise<InsightResponse> {
    if (!this.options.endpoint) {
      console.warn("OpenAI endpoint not configured. Returning mock response.");
      return this.buildMockResponse(payload);
    }

    const response = await fetch(this.options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "gpt-5.2-mini", // placeholder; configure during deployment
        prompt: payload.prompt,
        parameters: payload.parameters,
        tables: payload.tables,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI proxy returned ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as InsightResponse;
  }

  private buildMockResponse(payload: PromptRequestPayload): InsightResponse {
    return {
      headline: "Sales holding steady across monitored period",
      summary: `Generated mock summary using aggregation window \'${payload.parameters.aggregationPeriod || "Unknown"}\'.`,
      metrics: [
        {
          name: "Sales",
          current_value: "$12.4K",
          comparison_value: "$12.1K",
          absolute_delta: "$0.3K",
          percent_change: "+2.5%",
          is_improvement: true,
        },
      ],
      drivers: payload.parameters.dimensionBreakdownRequired
        ? [
            { dimension: "Region", member: "East", insight: "Accounts for largest share of growth" },
            { dimension: "Region", member: "Central", insight: "Slight decline but within expectation" },
          ]
        : [],
      trend_alerts: payload.parameters.trendDetectionRequired
        ? [
            { description: "Week-over-week lift detected", detected_on: null },
          ]
        : [],
      confidence: {
        level: "medium",
        reasons: "Mock response generated locally; replace with real OpenAI output",
      },
      diagnostics: null,
    };
  }
}
