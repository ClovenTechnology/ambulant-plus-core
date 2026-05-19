import type { UncertaintyBundle } from '../contracts/uncertainty';

export interface AbstentionDecision {
  abstain: boolean;
  reason?: string;
}

export class AbstentionPolicy {
  evaluate(bundle: UncertaintyBundle): AbstentionDecision {
    if (bundle.overall >= 0.7) {
      return {
        abstain: true,
        reason: 'overall_uncertainty_too_high',
      };
    }

    if (bundle.measurement.score >= 0.75) {
      return {
        abstain: true,
        reason: 'measurement_uncertainty_too_high',
      };
    }

    return { abstain: false };
  }
}