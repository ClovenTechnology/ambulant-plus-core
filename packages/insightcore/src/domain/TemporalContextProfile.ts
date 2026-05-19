import type { PersonalBaselineState } from '../baseline/PersonalBaselineState';

export class TemporalContextProfile {
  build(state: PersonalBaselineState) {
    return {
      patientId: state.patientId,
      generatedAt: new Date().toISOString(),
      windowsAvailable: {
        last24h: Boolean(state.windows.last24h),
        last7d: Boolean(state.windows.last7d),
        last30d: Boolean(state.windows.last30d),
      },
      restingHrTrend:
        this.delta(
          state.windows.last24h?.restingHrBaseline,
          state.windows.last30d?.restingHrBaseline,
        ),
      sleepTrend:
        this.delta(
          state.windows.last24h?.sleepHoursBaseline,
          state.windows.last30d?.sleepHoursBaseline,
        ),
      systolicTrend:
        this.delta(
          state.windows.last24h?.systolicBaseline,
          state.windows.last30d?.systolicBaseline,
        ),
    };
  }

  private delta(a?: number | null, b?: number | null) {
    if (a == null || b == null) return null;
    return Number((a - b).toFixed(2));
  }
}