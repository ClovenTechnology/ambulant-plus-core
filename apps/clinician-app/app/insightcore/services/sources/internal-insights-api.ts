// apps/clinician-app/app/insightcore/services/sources/internal-insights-api.ts

export type InsightPayload = {
  id: string;
  patientId: string;
  type: string; // e.g. 'clinical-pattern', 'risk-correlation', 'early-warning'
  description: string;
  confidence: number; // 0–1
  model: string;
  timestamp: number;
};

/**
 * Adapter boundary for Insight Generator outputs
 * Connects to real AI/ML insight services
 */
export function subscribeToInsights(
  onEvent: (data: InsightPayload) => void
) {
  console.info('[InsightCore] Internal Insights API adapter initialised');

  // Real future connections:
  // - websocket.subscribe('insights')
  // - kafka.subscribe('ai.insights')
  // - grpc.streamInsights()
  // - internal event gateway

  return () => {
    console.info('[InsightCore] Internal Insights API adapter closed');
  };
}
