import { PersonalBaselineGraph } from './PersonalBaselineGraph';
import type { LifestyleSnapshot, VitalsSnapshot } from '../contracts';
import type { PersonalBaselineSnapshot } from '../contracts/research';
import type { LongitudinalBaselineStore } from './LongitudinalBaselineStore';

export class LongitudinalPersonalBaselineGraph {
  constructor(private readonly store: LongitudinalBaselineStore) {}

  async build(args: {
    patientId: string;
    currentVitals: VitalsSnapshot;
    previousVitals?: VitalsSnapshot | null;
    lifestyle?: LifestyleSnapshot;
  }): Promise<PersonalBaselineSnapshot> {
    const previous = await this.store.load(args.patientId);

    const graph = new PersonalBaselineGraph().build({
      patientId: args.patientId,
      currentVitals: args.currentVitals,
      previousVitals: args.previousVitals,
      lifestyle: args.lifestyle,
      historical: previous
        ? {
            restingHr: previous.restingHrBaseline,
            avgSleepHours: previous.sleepHoursBaseline,
            systolic: previous.systolicBaseline,
            diastolic: previous.diastolicBaseline,
            spo2: previous.spo2Baseline,
            tempC: previous.temperatureBaseline,
            hrv: previous.hrvBaseline,
          }
        : undefined,
    });

    await this.store.save(args.patientId, graph);
    return graph;
  }
}