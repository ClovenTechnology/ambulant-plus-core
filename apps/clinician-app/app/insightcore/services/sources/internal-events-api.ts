// apps/clinician-app/app/insightcore/services/sources/internal-events-api.ts

export type SystemEventPayload = {
  id: string;
  type: string; // 'patient-update' | 'device-signal' | 'model-update' | 'alert-route'
  source: string; // service name
  payload: Record<string, any>;
  timestamp: number;
};

/**
 * Adapter boundary for system-wide internal events
 */
export function subscribeToInternalEvents(
  onEvent: (data: SystemEventPayload) => void
) {
  console.info('[InsightCore] Internal Events API adapter initialised');

  // Real future connections:
  // - event bus
  // - kafka topics
  // - redis streams
  // - nats
  // - websocket mesh

  return () => {
    console.info('[InsightCore] Internal Events API adapter closed');
  };
}
