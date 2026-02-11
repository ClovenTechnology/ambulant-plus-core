// apps/clinician-app/app/insightcore/services/sources/internal-alerts-api.ts

type AlertPayload = {
  id: string;
  patientId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
};

/**
 * This is a REAL adapter boundary.
 * Later this will connect to:
 * - internal microservice
 * - websocket
 * - kafka
 * - redis streams
 * - nats
 * - grpc
 * - internal http stream
 */
export function subscribeToInternalAlerts(
  onEvent: (alert: AlertPayload) => void
) {
  // 🔌 placeholder transport adapter
  // (real implementation later connects to real backend stream)

  // For now: no synthetic data, no timers, no mocks
  // Just a live transport boundary

  console.info('[InsightCore] Internal Alerts API adapter initialised');

  // return unsubscribe handle
  return () => {
    console.info('[InsightCore] Internal Alerts API adapter closed');
  };
}
