import type { PersonalBaselineState } from './PersonalBaselineState';

export class TemporalBaselineLens {
  build(state: PersonalBaselineState) {
    const last24h = state.windows.last24h;
    const last7d = state.windows.last7d;
    const last30d = state.windows.last30d;

    return {
      patientId: state.patientId,
      generatedAt: new Date().toISOString(),
      hrDelta24hVs30d: this.delta(
        last24h?.restingHrBaseline,
        last30d?.restingHrBaseline,
      ),
      sleepDelta24hVs30d: this.delta(
        last24h?.sleepHoursBaseline,
        last30d?.sleepHoursBaseline,
      ),
      systolicDelta24hVs30d: this.delta(
        last24h?.systolicBaseline,
        last30d?.systolicBaseline,
      ),
      diastolicDelta24hVs30d: this.delta(
        last24h?.diastolicBaseline,
        last30d?.diastolicBaseline,
      ),
      shortTermShift:
        Math.abs(this.delta(last24h?.restingHrBaseline, last7d?.restingHrBaseline) ?? 0) > 6,
    };
  }

  private delta(a?: number | null, b?: number | null) {
    if (a == null || b == null) return null;
    return Number((a - b).toFixed(2));
  }
}