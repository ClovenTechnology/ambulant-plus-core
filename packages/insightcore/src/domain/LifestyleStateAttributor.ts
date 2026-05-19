import type { FeatureVector } from '../contracts';

export class LifestyleStateAttributor {
  attribute(fv: FeatureVector) {
    const states: string[] = [];

    if (fv.poorSleep && fv.highStress) states.push('sleep_stress_coupling');
    if (fv.lowHydration && fv.tachycardia) states.push('dehydration_autonomic_load');
    if (fv.sedentary && fv.bpElevated) states.push('sedentary_pressure_risk');
    if ((fv.missedMedicationCount7d ?? 0) >= 2 && (fv.medicationAdherencePct ?? 100) < 80) {
      states.push('adherence_breakdown');
    }

    return {
      generatedAt: new Date().toISOString(),
      states,
    };
  }
}