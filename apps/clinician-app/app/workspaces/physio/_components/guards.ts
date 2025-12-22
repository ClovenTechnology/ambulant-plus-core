/* apps/clinician-app/app/workspaces/physio/_components/guards.ts */

import type { PhysioMeta } from './types';

export function isPainMeta(m: PhysioMeta): m is Extract<PhysioMeta, { findingType: 'pain' }> {
  return m.findingType === 'pain';
}
export function isRomMeta(m: PhysioMeta): m is Extract<PhysioMeta, { findingType: 'rom' }> {
  return m.findingType === 'rom';
}
export function isStrengthMeta(m: PhysioMeta): m is Extract<PhysioMeta, { findingType: 'strength' }> {
  return m.findingType === 'strength';
}
export function isSpecialTestMeta(m: PhysioMeta): m is Extract<PhysioMeta, { findingType: 'special_test' }> {
  return m.findingType === 'special_test';
}

export function safeNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
