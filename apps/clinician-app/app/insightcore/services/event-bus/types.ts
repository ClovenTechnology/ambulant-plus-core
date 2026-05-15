// services/event-bus/types.ts
export type EventType =
  | 'VITAL_INGESTED'
  | 'INFERENCE_READY'
  | 'ALERT_CREATED'
  | 'INSIGHT_GENERATED'
  | 'ACTION_RECOMMENDED';

export type EventPayload<T = any> = {
  id: string;
  type: EventType;
  entityId: string; // patientId, alertId, insightId, etc
  source: string;   // service name
  timestamp: string;
  data: T;
};

export type EventHandler<T = any> = (event: EventPayload<T>) => void | Promise<void>;