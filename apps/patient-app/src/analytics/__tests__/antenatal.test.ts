// ============================================================================
// apps/patient-app/src/analytics/__tests__/antenatal.test.ts
// Vitest: EDD, GA, schedule boundaries.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { calcEDD, gestationalAge, buildVisitSchedule, nextVisit, addDaysISO } from '../antenatal';

describe('antenatal analytics', () => {
  it('calcEDD adjusts for cycle length', () => {
    expect(calcEDD('2025-01-01', 28)).toBe('2025-10-08');
    expect(calcEDD('2025-01-01', 30)).toBe('2025-10-10');
  });

  it('gestationalAge returns weeks/days', () => {
    const edd = '2025-10-08';
    const today = '2025-07-02';
    const ga = gestationalAge(today, edd);
    expect(ga.weeks).toBeGreaterThan(0);
    expect(ga.days).toBeGreaterThanOrEqual(0);
  });

  it('schedule includes weekly near term and respects EDD', () => {
    const edd = '2025-10-08';
    const schedule = buildVisitSchedule(edd);
    expect(schedule.length).toBeGreaterThan(8);
    const last = schedule[schedule.length - 1];
    expect(last.date <= edd).toBe(true);
    const weeklyNearTerm = schedule.slice(-5).every((v, i, arr) => (i === 0 ? true : (new Date(v.date).getTime() - new Date(arr[i-1].date).getTime()) <= 8.65e7));
    expect(weeklyNearTerm).toBe(true);
  });

  it('nextVisit returns first future item', () => {
    const edd = '2025-10-08';
    const schedule = buildVisitSchedule(edd);
    const today = addDaysISO(edd, -40);
    const nv = nextVisit(schedule, today);
    expect(nv).not.toBeNull();
  });
});
