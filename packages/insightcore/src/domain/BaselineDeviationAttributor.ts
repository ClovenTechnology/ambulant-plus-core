import type { PersonalBaselineSnapshot } from '../contracts/research';

export class BaselineDeviationAttributor {
  attribute(baseline: PersonalBaselineSnapshot) {
    const labels: string[] = [];

    for (const d of baseline.deviations) {
      if (!d.abnormal) continue;

      if (d.metric === 'hr') labels.push('resting_hr_shift');
      if (d.metric === 'sleepHours') labels.push('sleep_baseline_shift');
      if (d.metric === 'systolic') labels.push('systolic_shift');
      if (d.metric === 'diastolic') labels.push('diastolic_shift');
      if (d.metric === 'spo2') labels.push('oxygen_shift');
      if (d.metric === 'hrv') labels.push('autonomic_shift');
    }

    return {
      generatedAt: new Date().toISOString(),
      labels,
    };
  }
}