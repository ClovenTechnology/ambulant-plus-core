export interface RuleWeightUpdateInput {
  orgId: string;
  key: string;
  value: number;
}

export interface PathwayUpdateInput {
  orgId: string;
  pathwayId: string;
  version: string;
  enabled: boolean;
}

export interface ExperimentUpdateInput {
  orgId: string;
  id: string;
  active: boolean;
}