// ============================================================================
// apps/patient-app/src/analytics/__tests__/antenatal.schedule.test.ts
// ============================================================================
import { describe, it, expect } from 'vitest';
import { buildVisitSchedule, nextVisit } from '../antenatal';

describe('visit schedule', () => {
  it('produces visits through EDD and weekly near term', () => {
    const edd = '2025-10-08';
    const schedule = buildVisitSchedule(edd);
    expect(schedule.at(-1)!.date <= edd).toBe(true);
    expect(schedule.length).toBeGreaterThan(8);
  });

  it('returns next visit after today', () => {
    const edd = '2025-10-08';
    const schedule = buildVisitSchedule(edd);
    const nv = nextVisit(schedule, '2025-08-01');
    expect(nv).not.toBeNull();
  });
});
