export interface RuleLineage {
  id: string;
  version: string;
  title: string;
  family: string;
  source: 'rule' | 'composite' | 'pathway' | 'hybrid';
}

export interface EngineLineage {
  id: string;
  version: string;
  title: string;
  category:
    | 'context'
    | 'feature_fabric'
    | 'inference'
    | 'pathway'
    | 'episodes'
    | 'alerts'
    | 'insights';
}

export interface LineageRecord {
  patientId: string;
  generatedAt: string;
  enginesRun: EngineLineage[];
  rulesApplied: RuleLineage[];
  pathwaysApplied: string[];
}