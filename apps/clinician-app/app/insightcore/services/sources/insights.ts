// apps/clinician-app/app/insightcore/services/sources/insights.ts
import type { Insight } from '../hooks/useInsightsFeed';

export function connectInsightsStream(onInsight: (i: Insight) => void) {
  // Production-safe placeholder:
  // No synthetic/demo insights are emitted here.
  // Wire this to the real insight API, SSE, WebSocket, or EventBus source.
  void onInsight;

  return () => {
    // no-op unsubscribe placeholder
  };
}
