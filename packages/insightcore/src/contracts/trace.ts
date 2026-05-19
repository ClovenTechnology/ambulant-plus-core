import type { EvidenceItem } from './index';

export interface EvidenceTraceNode {
  id: string;
  kind: 'input' | 'feature' | 'inference' | 'episode' | 'alert' | 'insight';
  label: string;
  source?: string;
  value?: string | number | boolean | null;
  timestamp?: string;
}

export interface EvidenceTraceEdge {
  from: string;
  to: string;
  reason: string;
}

export interface EvidenceTrace {
  patientId: string;
  generatedAt: string;
  nodes: EvidenceTraceNode[];
  edges: EvidenceTraceEdge[];
  evidence: EvidenceItem[];
}