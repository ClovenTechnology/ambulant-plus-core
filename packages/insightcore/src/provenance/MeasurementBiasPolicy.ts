import type { MeasurementBiasAssessment } from '../contracts/measurement-bias';
import type { ProvenancedEvidence } from '../contracts/provenance';

export class MeasurementBiasPolicy {
  assess(evidence: ProvenancedEvidence[]): MeasurementBiasAssessment {
    const flags = [];
    let adjustedWeightDelta = 0;

    const knownBias = evidence.flatMap((e) => e.provenance.knownBiasFlags ?? []);
    for (const item of knownBias) {
      flags.push({
        code: item,
        label: item,
        severity: 'moderate' as const,
      });
      adjustedWeightDelta -= 0.08;
    }

    return {
      flags,
      adjustedWeightDelta,
    };
  }
}