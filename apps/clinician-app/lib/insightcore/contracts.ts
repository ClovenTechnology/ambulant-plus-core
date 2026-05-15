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


