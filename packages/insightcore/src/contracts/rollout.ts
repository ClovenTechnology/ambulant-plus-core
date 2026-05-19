export interface ModelRollout {
  modelId: string;
  version: string;
  enabled: boolean;
  trafficPercent: number;
  orgId?: string;
  audience?: 'patient' | 'clinician' | 'admin' | 'all';
  updatedAt: string;
}

export interface PathwayVersionRecord {
  pathwayId: string;
  version: string;
  enabled: boolean;
  orgId?: string;
  updatedAt: string;
}

export interface ExperimentRecord {
  id: string;
  title: string;
  family: 'weights' | 'pathway' | 'ml';
  version: string;
  active: boolean;
  orgId?: string;
  updatedAt: string;
}