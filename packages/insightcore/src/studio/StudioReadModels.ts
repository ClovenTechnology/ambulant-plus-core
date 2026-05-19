import type { EvidenceTrace } from '../contracts/trace';
import type { LineageRecord } from '../contracts/lineage';
import type { Episode } from '../contracts';

export interface StudioEpisodeSummary {
  id: string;
  patientId: string;
  title: string;
  syndrome: string;
  severity: string;
  status: string;
  updatedAt: string;
  riskScore: number;
}

export interface StudioReadModels {
  listEpisodes(args?: { patientId?: string; orgId?: string }): Promise<StudioEpisodeSummary[]>;
  getTrace(args: { patientId: string }): Promise<EvidenceTrace | null>;
  getLineage(args: { patientId: string }): Promise<LineageRecord | null>;
}