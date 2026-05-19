import type { PersonalBaselineState } from './PersonalBaselineState';

export class BaselineTrendInterpreter {
  interpret(state: PersonalBaselineState) {
    const hr24 = state.windows.last24h?.restingHrBaseline ?? null;
    const hr30 = state.windows.last30d?.restingHrBaseline ?? null;
    const sleep24 = state.windows.last24h?.sleepHoursBaseline ?? null;
    const sleep30 = state.windows.last30d?.sleepHoursBaseline ?? null;
    const sys24 = state.windows.last24h?.systolicBaseline ?? null;
    const sys30 = state.windows.last30d?.systolicBaseline ?? null;

    return {
      generatedAt: new Date().toISOString(),
      restingHrDirection: this.direction(hr24, hr30),
      sleepDirection: this.direction(sleep24, sleep30, true),
      systolicDirection: this.direction(sys24, sys30),
    };
  }

  private direction(current: number | null, baseline: number | null, inverse = false) {
    if (current == null || baseline == null) return 'unknown';
    const delta = current - baseline;
    if (Math.abs(delta) < 1) return 'stable';
    if (inverse) return delta < 0 ? 'worsening' : 'improving';
    return delta > 0 ? 'rising' : 'falling';
    }
}