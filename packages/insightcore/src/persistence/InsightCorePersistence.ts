import type { EvidenceTrace } from '../contracts/trace';
import type { LineageRecord } from '../contracts/lineage';

export interface InsightCorePersistence {
  saveTrace(args: {
    patientId: string;
    orgId?: string;
    trace: EvidenceTrace;
  }): Promise<void>;

  saveLineage(args: {
    patientId: string;
    orgId?: string;
    lineage: LineageRecord;
  }): Promise<void>;
}