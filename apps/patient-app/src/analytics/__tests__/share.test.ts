// ============================================================================
// apps/patient-app/src/analytics/__tests__/share.test.ts
// ============================================================================
import { describe, it, expect } from 'vitest';
import { encodeAntenatalShareToken, decodeAntenatalShareToken } from '../share';

describe('antenatal share token', () => {
  it('round-trips payload', () => {
    const tok = encodeAntenatalShareToken({ edd: '2025-10-08', name: 'Ada' });
    const dec = decodeAntenatalShareToken(tok)!;
    expect(dec.edd).toBe('2025-10-08');
    expect(dec.name).toBe('Ada');
    expect(dec.v).toBe(1);
  });

  it('rejects invalid token', () => {
    const dec = decodeAntenatalShareToken('!!!');
    expect(dec).toBeNull();
  });
});
