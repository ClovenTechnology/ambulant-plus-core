// apps/clinician-app/app/insightcore/services/sources/inference.ts
import type { Risk } from '../hooks/useRiskFeed';

export function connectInferenceStream(onRisk: (r: Risk) => void) {
  // Production-safe placeholder:
  // No synthetic/demo risk signals are emitted here.
  // Wire this to the real risk/inference API, SSE, WebSocket, or EventBus source.
  void onRisk;

  return () => {
    // no-op unsubscribe placeholder
  };
}
