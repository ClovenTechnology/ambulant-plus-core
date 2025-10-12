// ============================================================================
// apps/patient-app/src/analytics/__tests__/ics.antenatal.location.test.ts
// ============================================================================
import { describe, it, expect } from 'vitest';
import { buildAntenatalICSUrlFromPrefs } from '../../analytics/ics';

describe('antenatal ics url with options', () => {
  it('includes location & telehealth params', () => {
    const url = buildAntenatalICSUrlFromPrefs({ edd:'2025-10-08' }, 'https://x.test', { location:'Ambulant+ Virtual Clinic', telehealth:'https://tele.health/abc' })!;
    expect(url).toContain('location=');
    expect(url).toContain('telehealth=');
  });
});
