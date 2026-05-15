// apps/clinician-app/app/insightcore/services/sources/alerts.ts
import type { Alert } from '../hooks/useAlertsFeed';

export function connectAlertsStream(onAlert: (a: Alert) => void) {
  // Production-safe placeholder:
  // No synthetic/demo alerts are emitted here.
  // Wire this to the real alerts API, SSE, WebSocket, or EventBus source.
  void onAlert;

  return () => {
    // no-op unsubscribe placeholder
  };
}