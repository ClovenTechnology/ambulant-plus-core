// ============================================================================
// apps/patient-app/src/analytics/__tests__/ics.lab.test.ts
// ============================================================================
import { describe, it, expect } from 'vitest';
import { buildLabICSUrl } from '../../analytics/ics';

describe('lab ics url', () => {
  it('builds due url', () => {
    const url = buildLabICSUrl('https://example.com', '2025-10-08', 'OGTT', 'due', false);
    expect(url).toContain('/api/ics/antenatal-lab');
    expect(url).toContain('OGTT');
    expect(url).toContain('due');
  });
  it('builds overdue url with flag', () => {
    const url = buildLabICSUrl('https://example.com', '2025-10-08', 'GBS', 'due', true);
    expect(url).toContain('overdue=1');
  });
});
