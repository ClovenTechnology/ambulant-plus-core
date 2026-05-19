import type { LifestyleSnapshot, VitalsSnapshot } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';

export class BaselineWindowAggregator {
  build(args: {
    patientId: string;
    window: '24h' | '7d' | '30d';
    currentVitals: VitalsSnapshot;
    lifestyle?: LifestyleSnapshot;
    previous?: PersonalBaselineSnapshot | null;
  }): PersonalBaselineSnapshot {
    const prev = args.previous;

    const hrBase =
      prev?.restingHrBaseline ??
      args.currentVitals.hr ??
      null;

    const sleepBase =
      prev?.sleepHoursBaseline ??
      args.lifestyle?.sleepHours ??
      null;

    const sysBase =
      prev?.systolicBaseline ??
      args.currentVitals.systolic ??
      null;

    const diaBase =
      prev?.diastolicBaseline ??
      args.currentVitals.diastolic ??
      null;

    const spo2Base =
      prev?.spo2Baseline ??
      args.currentVitals.spo2 ??
      null;

    const tempBase =
      prev?.temperatureBaseline ??
      args.currentVitals.tempC ??
      null;

    const hrvBase =
      prev?.hrvBaseline ??
      args.currentVitals.hrv ??
      null;

    return {
      patientId: args.patientId,
      generatedAt: new Date().toISOString(),
      restingHrBaseline: hrBase,
      sleepHoursBaseline: sleepBase,
      systolicBaseline: sysBase,
      diastolicBaseline: diaBase,
      spo2Baseline: spo2Base,
      temperatureBaseline: tempBase,
      hrvBaseline: hrvBase,
      deviations: [],
    };
  }
}