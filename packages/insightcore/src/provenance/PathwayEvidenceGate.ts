import type { ProvenancedEvidence } from '../contracts/provenance';

export class PathwayEvidenceGate {
  allow(args: { pathwayId: string; evidence: ProvenancedEvidence[] }) {
    const avgWeight =
      args.evidence.length === 0
        ? 0
        : args.evidence.reduce((sum, e) => sum + (e.weight ?? 0), 0) / args.evidence.length;

    if (args.pathwayId === 'seizure-research-engine') {
      return avgWeight >= 0.65;
    }

    if (args.pathwayId === 'sleep-debt-bp-trajectory') {
      return avgWeight >= 0.55;
    }

    return avgWeight >= 0.45;
  }
}