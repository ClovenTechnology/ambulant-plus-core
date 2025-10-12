// ============================================================================
// apps/patient-app/src/analytics/__tests__/ics.address.geo.test.ts
// Vitest: ensure URL carries address/geo
// ============================================================================
import { describe, it, expect } from 'vitest';
import { buildAntenatalICSUrlFromPrefs } from '../../analytics/ics';

describe('antenatal ics url with address/geo', () => {
  it('includes addr and geo params', () => {
    const url = buildAntenatalICSUrlFromPrefs(
      { edd: '2025-10-08' },
      'https://x.test',
      { address: 'Line1\nLine2', geo: { lat: -26.2041, lon: 28.0473 } }
    )!;
    expect(url).toContain('addr=');
    expect(url).toContain('geoLat=');
    expect(url).toContain('geoLon=');
  });
});