import type { ProvenancedEvidence } from '../contracts/provenance';

export class BiasImpactEngine {
  compute(evidence: ProvenancedEvidence[]) {
    let biasScore = 0;

    for (const e of evidence) {
      if (e.provenance.knownBiasFlags?.length) {
        biasScore += 0.1 * e.provenance.knownBiasFlags.length;
      }
    }

    return Math.min(1, Number(biasScore.toFixed(2)));
  }
}