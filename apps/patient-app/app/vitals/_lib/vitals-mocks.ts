// apps/patient-app/app/vitals/_lib/vitals-mocks.ts
import type { Vital, VitalsRange } from './vitals-ui';

/**
 * Production-disabled compatibility shim.
 *
 * This file previously generated synthetic vitals. Patient-app is now moving
 * to production-only data paths, so mock generation must never create fake
 * clinical readings.
 *
 * Keep these exports temporarily so older imports do not break the build while
 * the remaining routes/components are migrated away from mock helpers.
 */

export function shouldUseMockVitals(_args?: {
  searchParamMock?: string | null;
  envMock?: string | undefined;
}): false {
  return false;
}

export function generateMockVitalsTimeline(
  _range: VitalsRange,
  _customStart?: string,
  _customEnd?: string,
): Vital[] {
  return [];
}