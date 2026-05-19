import type { PersonalBaselineState } from './PersonalBaselineState';

export class BaselineDriftEngine {
  evaluate(state: PersonalBaselineState) {
    const last24h = state.windows.last24h;
    const last7d = state.windows.last7d;
    const last30d = state.windows.last30d;

    const drift = {
      hr:
        this.delta(last24h?.restingHrBaseline, last30d?.restingHrBaseline),
      sleep:
        this.delta(last24h?.sleepHoursBaseline, last30d?.sleepHoursBaseline),
      systolic:
        this.delta(last24h?.systolicBaseline, last30d?.systolicBaseline),
      diastolic:
        this.delta(last24h?.diastolicBaseline, last30d?.diastolicBaseline),
    };

    return {
      generatedAt: new Date().toISOString(),
      drift,
      flags: [
        ...(Math.abs(drift.hr ?? 0) >= 8 ? ['resting_hr_drift'] : []),
        ...(Math.abs(drift.sleep ?? 0) >= 1.5 ? ['sleep_baseline_drift'] : []),
        ...(Math.abs(drift.systolic ?? 0) >= 8 ? ['systolic_baseline_drift'] : []),
      ],
    };
  }

  private delta(a?: number | null, b?: number | null) {
    if (a == null || b == null) return null;
    return Number((a - b).toFixed(2));
  }
}