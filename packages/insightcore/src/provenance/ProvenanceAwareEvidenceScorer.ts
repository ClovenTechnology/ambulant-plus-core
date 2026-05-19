import type { ProvenancedEvidence } from '../contracts/provenance';

export class ProvenanceAwareEvidenceScorer {
  score(evidence: ProvenancedEvidence[]): ProvenancedEvidence[] {
    return evidence.map((item) => {
      let weight = item.weight ?? 0.5;

      const q = item.provenance.signalQuality ?? 0.7;
      weight += (q - 0.5) * 0.3;

      if ((item.provenance.sourcePriority ?? 0) >= 80) {
        weight += 0.1;
      }

      if ((item.provenance.knownBiasFlags ?? []).length > 0) {
        weight -= 0.12;
      }

      if (item.provenance.sourceType === 'clinician_measured') {
        weight += 0.08;
      }

      return {
        ...item,
        weight: Number(Math.max(0, Math.min(1, weight)).toFixed(3)),
      };
    });
  }
}