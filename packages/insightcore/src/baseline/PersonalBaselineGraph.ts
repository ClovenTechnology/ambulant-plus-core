import type { LifestyleSnapshot, VitalsSnapshot } from '../contracts';
import type { BaselineDeviation, PersonalBaselineSnapshot } from '../contracts/research';

export interface PersonalBaselineGraphInput {
  patientId: string;
  currentVitals: VitalsSnapshot;
  previousVitals?: VitalsSnapshot | null;
  lifestyle?: LifestyleSnapshot;
  historical?: {
    restingHr?: number | null;
    avgSleepHours?: number | null;
    systolic?: number | null;
    diastolic?: number | null;
    spo2?: number | null;
    tempC?: number | null;
    hrv?: number | null;
  };
}

export class PersonalBaselineGraph {
  build(input: PersonalBaselineGraphInput): PersonalBaselineSnapshot {
    const restingHrBaseline =
      input.historical?.restingHr ??
      input.previousVitals?.hr ??
      null;

    const sleepHoursBaseline =
      input.historical?.avgSleepHours ??
      input.lifestyle?.sleepHours ??
      null;

    const systolicBaseline =
      input.historical?.systolic ??
      input.previousVitals?.systolic ??
      null;

    const diastolicBaseline =
      input.historical?.diastolic ??
      input.previousVitals?.diastolic ??
      null;

    const spo2Baseline =
      input.historical?.spo2 ??
      input.previousVitals?.spo2 ??
      null;

    const temperatureBaseline =
      input.historical?.tempC ??
      input.previousVitals?.tempC ??
      null;

    const hrvBaseline =
      input.historical?.hrv ??
      input.previousVitals?.hrv ??
      null;

    const deviations: BaselineDeviation[] = [
      this.deviation('hr', restingHrBaseline, input.currentVitals.hr ?? null, 0.15),
      this.deviation('sleepHours', sleepHoursBaseline, input.lifestyle?.sleepHours ?? null, 0.2),
      this.deviation('systolic', systolicBaseline, input.currentVitals.systolic ?? null, 0.1),
      this.deviation('diastolic', diastolicBaseline, input.currentVitals.diastolic ?? null, 0.1),
      this.deviation('spo2', spo2Baseline, input.currentVitals.spo2 ?? null, 0.03),
      this.deviation('tempC', temperatureBaseline, input.currentVitals.tempC ?? null, 0.02),
      this.deviation('hrv', hrvBaseline, input.currentVitals.hrv ?? null, 0.2),
    ];

    return {
      patientId: input.patientId,
      generatedAt: new Date().toISOString(),
      restingHrBaseline,
      sleepHoursBaseline,
      systolicBaseline,
      diastolicBaseline,
      spo2Baseline,
      temperatureBaseline,
      hrvBaseline,
      deviations,
    };
  }

  private deviation(
    metric: string,
    baseline: number | null,
    current: number | null,
    thresholdPct: number,
  ): BaselineDeviation {
    if (baseline == null || current == null || baseline === 0) {
      return {
        metric,
        baseline,
        current,
        delta: null,
        deltaPct: null,
        abnormal: false,
      };
    }

    const delta = Number((current - baseline).toFixed(2));
    const deltaPct = Number((delta / baseline).toFixed(3));
    return {
      metric,
      baseline,
      current,
      delta,
      deltaPct,
      abnormal: Math.abs(deltaPct) >= thresholdPct,
    };
  }
}