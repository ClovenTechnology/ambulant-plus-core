export interface GovernedRuleWeight {
  key: string;
  value: number;
  min?: number;
  max?: number;
  updatedAt: string;
  source: 'default' | 'org_override' | 'experiment';
}

export interface GovernedPathway {
  id: string;
  version: string;
  enabled: boolean;
  owner: string;
  title: string;
  description: string;
  updatedAt: string;
}

export interface TraceRecord {
  id: string;
  patientId: string;
  orgId?: string;
  generatedAt: string;
  payload: string;
}

export interface LineageStoredRecord {
  id: string;
  patientId: string;
  orgId?: string;
  generatedAt: string;
  payload: string;
}