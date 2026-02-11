// apps/clinician-app/app/insightcore/services/sources/internal-risk-api.ts

export type RiskPayload = {
  patientId: string;
  riskType: string; // e.g. 'cardiac', 'respiratory', 'sepsis', 'deterioration'
  score: number; // 0–1
  severity: 'low' | 'medium' | 'high' | 'critical';
  contributingSignals: string[];
  model: string;
  timestamp: number;
};

/**
 * Adapter boundary for Risk Engine outputs
 */
export function subscribeToRiskSignals(
  onEvent: (data: RiskPayload) => void
) {
  console.info('[InsightCore] Internal Risk API adapter initialised');

  // Real future connections:
  // - kafka.subscribe('risk.signals')
  // - websocket stream
  // - grpc
  // - internal message bus

  return () => {
    console.info('[InsightCore] Internal Risk API adapter closed');
  };
}
