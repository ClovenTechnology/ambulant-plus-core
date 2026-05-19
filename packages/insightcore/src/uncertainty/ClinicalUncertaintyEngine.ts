import type { FeatureVector } from '../contracts';
import type { ClinicalUncertainty } from '../contracts/uncertainty';

export class ClinicalUncertaintyEngine {
  evaluate(fv: FeatureVector): ClinicalUncertainty {
    const reasons: string[] = [];
    let score = 0.2;

    if (fv.recentDiagnoses.length === 0 && fv.recentSymptoms.length === 0) {
      score += 0.18;
      reasons.push('limited_contextual_clinical_labels');
    }

    if (fv.activeConditions.length === 0) {
      score += 0.08;
      reasons.push('no_active_conditions_recorded');
    }

    if ((fv.evidence?.length ?? 0) < 4) {
      score += 0.16;
      reasons.push('low_evidence_count');
    }

    return {
      score: Number(Math.min(1, score).toFixed(3)),
      reasons,
    };
  }
}