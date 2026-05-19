import type { InferenceOutput } from '../contracts';
import type { InferenceUncertainty } from '../contracts/uncertainty';

export class InferenceUncertaintyEngine {
  evaluate(inferences: InferenceOutput[]): InferenceUncertainty {
    let score = 0.18;
    const reasons: string[] = [];

    if (inferences.length === 0) {
      score += 0.22;
      reasons.push('no_inferences_generated');
    }

    const lowConfidence = inferences.filter((i) => i.confidence < 0.6);
    if (lowConfidence.length > 0) {
      score += 0.16;
      reasons.push('low_confidence_inferences_present');
    }

    const mixedSyndromes = new Set(inferences.map((i) => i.syndrome).filter(Boolean));
    if (mixedSyndromes.size > 2) {
      score += 0.1;
      reasons.push('multi_syndrome_signal_complexity');
    }

    return {
      score: Number(Math.min(1, score).toFixed(3)),
      reasons,
    };
  }
}