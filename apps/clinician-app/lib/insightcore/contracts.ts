/lib/insightcore/contracts.ts
// lib/insightcore/contracts.ts
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Alert = {
  id: string;
  patientId: string;
  type: string;
  severity: RiskLevel;
  score: number;
  source: 'model' | 'rule' | 'hybrid';
  timestamp: string;
  status: 'new' | 'ack' | 'resolved';
};

export type InferenceOutput = {
  patientId: string;
  model: string;
  output: Record<string, number>;
  confidence: number;
  timestamp: string;
};

export type Insight = {
  id: string;
  patientId: string;
  title: string;
  explanation: string;
  evidence: string[];
  confidence: number;
  sourceModels: string[];
  recommendedActions: string[];
  timestamp: string;
};


// services/event-bus/index.ts
export type EventType =
  | 'VITAL_INGESTED'
  | 'INFERENCE_READY'
  | 'ALERT_CREATED'
  | 'INSIGHT_GENERATED'
  | 'ACTION_RECOMMENDED';

export type EventPayload = {
  type: EventType;
  entityId: string;
  source: string;
  timestamp: string;
  data: unknown;
};

export interface EventBus {
  publish(event: EventPayload): Promise<void>;
  subscribe(type: EventType, handler: (event: EventPayload) => void): void;
}


// services/inference-engine/index.ts
import { InferenceOutput } from '@/lib/insightcore/contracts';

export interface InferenceEngine {
  run(patientId: string, vitals: Record<string, any>): Promise<InferenceOutput[]>;
}


// services/insight-generator/index.ts
import { Insight, InferenceOutput } from '@/lib/insightcore/contracts';

export interface InsightGenerator {
  generate(inference: InferenceOutput[]): Promise<Insight[]>;
}


// services/alert-engine/index.ts
import { Alert, InferenceOutput } from '@/lib/insightcore/contracts';

export interface AlertEngine {
  evaluate(inference: InferenceOutput[]): Promise<Alert[]>;
}
