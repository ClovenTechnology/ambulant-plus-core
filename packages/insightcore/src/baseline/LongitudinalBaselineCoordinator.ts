import type { LifestyleSnapshot, VitalsSnapshot } from '../contracts';
import type { PersonalBaselineState } from './PersonalBaselineState';
import type { BaselineWindowStore } from './BaselineWindowStore';
import { BaselineWindowAggregator } from './BaselineWindowAggregator';

export class LongitudinalBaselineCoordinator {
  constructor(private readonly store: BaselineWindowStore) {}

  async build(args: {
    patientId: string;
    currentVitals: VitalsSnapshot;
    lifestyle?: LifestyleSnapshot;
  }): Promise<PersonalBaselineState> {
    const aggregator = new BaselineWindowAggregator();

    const previous24h = await this.store.load(args.patientId, '24h');
    const previous7d = await this.store.load(args.patientId, '7d');
    const previous30d = await this.store.load(args.patientId, '30d');

    const snapshot24h = aggregator.build({
      patientId: args.patientId,
      window: '24h',
      currentVitals: args.currentVitals,
      lifestyle: args.lifestyle,
      previous: previous24h?.snapshot ?? null,
    });

    const snapshot7d = aggregator.build({
      patientId: args.patientId,
      window: '7d',
      currentVitals: args.currentVitals,
      lifestyle: args.lifestyle,
      previous: previous7d?.snapshot ?? null,
    });

    const snapshot30d = aggregator.build({
      patientId: args.patientId,
      window: '30d',
      currentVitals: args.currentVitals,
      lifestyle: args.lifestyle,
      previous: previous30d?.snapshot ?? null,
    });

    await Promise.all([
      this.store.save({
        patientId: args.patientId,
        window: '24h',
        generatedAt: new Date().toISOString(),
        snapshot: snapshot24h,
      }),
      this.store.save({
        patientId: args.patientId,
        window: '7d',
        generatedAt: new Date().toISOString(),
        snapshot: snapshot7d,
      }),
      this.store.save({
        patientId: args.patientId,
        window: '30d',
        generatedAt: new Date().toISOString(),
        snapshot: snapshot30d,
      }),
    ]);

    return {
      patientId: args.patientId,
      generatedAt: new Date().toISOString(),
      windows: {
        last24h: snapshot24h,
        last7d: snapshot7d,
        last30d: snapshot30d,
      },
    };
  }
}