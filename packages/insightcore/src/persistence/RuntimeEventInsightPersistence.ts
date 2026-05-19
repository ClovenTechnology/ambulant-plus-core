import type { InsightCorePersistence } from './InsightCorePersistence';
import type { EvidenceTrace } from '../contracts/trace';
import type { LineageRecord } from '../contracts/lineage';

export interface RuntimeEventWriter {
  create(args: {
    kind: string;
    patientId: string;
    orgId?: string;
    payload: string;
  }): Promise<void>;
}

export class RuntimeEventInsightPersistence implements InsightCorePersistence {
  constructor(private readonly writer: RuntimeEventWriter) {}

  async saveTrace(args: {
    patientId: string;
    orgId?: string;
    trace: EvidenceTrace;
  }): Promise<void> {
    await this.writer.create({
      kind: 'insight.trace.v1',
      patientId: args.patientId,
      orgId: args.orgId,
      payload: JSON.stringify(args.trace),
    });
  }

  async saveLineage(args: {
    patientId: string;
    orgId?: string;
    lineage: LineageRecord;
  }): Promise<void> {
    await this.writer.create({
      kind: 'insight.lineage.v1',
      patientId: args.patientId,
      orgId: args.orgId,
      payload: JSON.stringify(args.lineage),
    });
  }
}