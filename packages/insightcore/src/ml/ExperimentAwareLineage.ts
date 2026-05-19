import type { LineageRecord } from '../contracts/lineage';

export interface ExperimentAwareLineageRecord extends LineageRecord {
  experiments?: string[];
}

export class ExperimentAwareLineage {
  attach(lineage: LineageRecord, experiments: string[]): ExperimentAwareLineageRecord {
    return {
      ...lineage,
      experiments,
    };
  }
}