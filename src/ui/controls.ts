export interface ControlValues {
  userPrompt: string;
  aggregationPeriod: string;
  comparisonPeriod: string;
  comparisonSpan: string;
  improvementDirection: "neutral" | "desired_increase" | "desired_decrease";
  dimensionBreakdownRequired: boolean;
  trendDetectionRequired: boolean;
}

export interface ControlsBinding {
  readValues: () => ControlValues;
  setLoading: (loading: boolean) => void;
  setStatus: (message: string) => void;
}

export function bindControls(onRefresh: (values: ControlValues) => void): ControlsBinding {
  const promptEl = document.getElementById("userPrompt") as HTMLTextAreaElement | null;
  const aggregationEl = document.getElementById("aggregationPeriod") as HTMLInputElement | null;
  const comparisonEl = document.getElementById("comparisonPeriod") as HTMLInputElement | null;
  const spanEl = document.getElementById("comparisonSpan") as HTMLSelectElement | null;
  const directionEl = document.getElementById("improvementDirection") as HTMLSelectElement | null;
  const dimensionEl = document.getElementById("dimensionBreakdown") as HTMLInputElement | null;
  const trendEl = document.getElementById("trendDetection") as HTMLInputElement | null;
  const refreshBtn = document.getElementById("refreshInsights") as HTMLButtonElement | null;
  const statusEl = document.getElementById("status") as HTMLSpanElement | null;

  if (!refreshBtn) {
    throw new Error("Refresh button not found in DOM");
  }

  const readValues = (): ControlValues => ({
    userPrompt: promptEl?.value?.trim() ?? "",
    aggregationPeriod: aggregationEl?.value?.trim() ?? "",
    comparisonPeriod: comparisonEl?.value?.trim() ?? "",
    comparisonSpan: spanEl?.value ?? "",
    improvementDirection: (directionEl?.value ?? "neutral") as ControlValues["improvementDirection"],
    dimensionBreakdownRequired: Boolean(dimensionEl?.checked),
    trendDetectionRequired: Boolean(trendEl?.checked),
  });

  const setLoading = (loading: boolean): void => {
    refreshBtn.disabled = loading;
    if (loading) {
      refreshBtn.setAttribute("aria-busy", "true");
    } else {
      refreshBtn.removeAttribute("aria-busy");
    }
  };

  const setStatus = (message: string): void => {
    if (statusEl) {
      statusEl.textContent = message;
    }
  };

  refreshBtn.addEventListener("click", () => onRefresh(readValues()));

  return { readValues, setLoading, setStatus };
}
