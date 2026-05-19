import type { PersonalBaselineState } from './PersonalBaselineState';

export class CircadianBaselineProfile {
  build(state: PersonalBaselineState) {
    return {
      patientId: state.patientId,
      generatedAt: new Date().toISOString(),
      profile: {
        morning: state.windows.last24h?.restingHrBaseline ?? null,
        daytime: state.windows.last7d?.restingHrBaseline ?? null,
        longRun: state.windows.last30d?.restingHrBaseline ?? null,
      },
    };
  }
}