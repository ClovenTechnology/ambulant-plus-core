import type { ProvenancedEvidence } from '../contracts/provenance';
import type { MeasurementUncertainty } from '../contracts/uncertainty';

export class MeasurementUncertaintyEngine {
  evaluate(evidence: ProvenancedEvidence[]): MeasurementUncertainty {
    const reasons: string[] = [];
    let score = 0.2;

    const lowQuality = evidence.filter((e) => (e.provenance.signalQuality ?? 1) < 0.5);
    if (lowQuality.length > 0) {
      score += 0.2;
      reasons.push('low_signal_quality_present');
    }

    const biasFlags = evidence.flatMap((e) => e.provenance.knownBiasFlags ?? []);
    if (biasFlags.length > 0) {
      score += 0.18;
      reasons.push('known_measurement_bias_flags_present');
    }

    const lowPriority = evidence.filter((e) => (e.provenance.sourcePriority ?? 100) < 40);
    if (lowPriority.length > 0) {
      score += 0.12;
      reasons.push('low_priority_sources_present');
    }

    return {
      score: Number(Math.min(1, score).toFixed(3)),
      reasons,
    };
  }
}