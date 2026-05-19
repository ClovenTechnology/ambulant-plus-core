// packages/insightcore/src/provenance/EvidenceReliabilityScorer.ts
import { DeviceReliabilityRegistry } from './DeviceReliabilityRegistry';
import type { ProvenancedEvidence } from '../contracts/provenance';

function normalizeWeight(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) return 1;

  return Math.max(0, Math.min(1, n));
}

export class EvidenceReliabilityScorer {
  private registry = new DeviceReliabilityRegistry();

  score(evidence: ProvenancedEvidence[]): ProvenancedEvidence[] {
    return evidence.map((item) => {
      const reliability = this.registry.get(item.provenance.deviceClass);
      const baseWeight = normalizeWeight(item.weight);

      return {
        ...item,
        weight: Number((baseWeight * reliability).toFixed(3)),
      };
    });
  }
}