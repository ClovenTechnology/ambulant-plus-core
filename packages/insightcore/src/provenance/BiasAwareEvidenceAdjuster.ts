import type { ProvenancedEvidence } from '../contracts/provenance';
import { MeasurementBiasPolicy } from './MeasurementBiasPolicy';

export class BiasAwareEvidenceAdjuster {
  private policy = new MeasurementBiasPolicy();

  adjust(evidence: ProvenancedEvidence[]): ProvenancedEvidence[] {
    const assessment = this.policy.assess(evidence);

    return evidence.map((item) => {
      const adjusted = (item.weight ?? 0.5) + assessment.adjustedWeightDelta;
      return {
        ...item,
        weight: Number(Math.max(0, Math.min(1, adjusted)).toFixed(3)),
      };
    });
  }
}