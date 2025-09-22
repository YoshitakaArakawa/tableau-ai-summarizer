import { bindControls, ControlValues, ControlsBinding } from "./ui/controls";
import { fetchSummaryContext, SummaryContext } from "./tables/summaryParser";
import { buildPromptPayload, PromptRequestPayload } from "./prompt/payloadBuilder";
import { OpenAIClient, InsightResponse } from "./api/openaiClient";

export class PulseVizApp {
  private readonly openAI: OpenAIClient;
  private controls!: ControlsBinding;
  private readonly insightOutput: HTMLElement;

  constructor(endpoint?: string) {
    this.openAI = new OpenAIClient({ endpoint });
    const insightOutput = document.getElementById("insightOutput");
    if (!insightOutput) {
      throw new Error("Insight output element not found");
    }
    this.insightOutput = insightOutput;
  }

  async initialize(): Promise<void> {
    this.controls = bindControls(async (values) => {
      await this.refresh(values);
    });

    this.controls.setStatus("Ready to generate summaries");
  }

  private async refresh(values?: ControlValues): Promise<void> {
    const controlValues = values ?? this.controls.readValues();

    this.controls.setLoading(true);
    this.controls.setStatus("Fetching data...");

    try {
      const summaryContext = await fetchSummaryContext();
      const payload = await this.preparePromptPayload(controlValues, summaryContext);

      this.controls.setStatus("Generating insights...");
      const response = await this.openAI.generateInsights(payload);

      this.renderInsight(response);
      this.controls.setStatus("Summary updated");
    } catch (error) {
      console.error("Failed to generate insights", error);
      this.controls.setStatus(error instanceof Error ? error.message : "Failed to generate insights");
    } finally {
      this.controls.setLoading(false);
    }
  }

  private async preparePromptPayload(values: ControlValues, context: SummaryContext): Promise<PromptRequestPayload> {
    return buildPromptPayload({
      controls: values,
      data: context,
    });
  }

  private renderInsight(response: InsightResponse): void {
    const pretty = JSON.stringify(response, null, 2);
    this.insightOutput.textContent = pretty;
  }
}

const defaultEndpoint = (window as any)?.PULSE_VIZ_ENDPOINT ?? "http://localhost:8787/api/generate";
const app = new PulseVizApp(defaultEndpoint);
app.initialize().catch((error) => {
  console.error("Failed to initialize PulseVizApp", error);
});
