// ============================================================================
// apps/patient-app/src/analytics/__tests__/share.roles.test.ts
// ============================================================================
import { describe, it, expect } from 'vitest';
import { encodeAntenatalShareToken, decodeAntenatalShareToken } from '../../analytics/share';

describe('share roles', () => {
  it('round-trips partner role', () => {
    const tok = encodeAntenatalShareToken({ edd: '2025-10-08', role: 'partner' });
    const dec = decodeAntenatalShareToken(tok)!;
    expect(dec.edd).toBe('2025-10-08');
    expect(dec.role).toBe('partner');
  });
  it('round-trips provider role', () => {
    const tok = encodeAntenatalShareToken({ edd: '2025-10-08', role: 'provider', name: 'Ada' });
    const dec = decodeAntenatalShareToken(tok)!;
    expect(dec.role).toBe('provider');
    expect(dec.name).toBe('Ada');
  });
});
