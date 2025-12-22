// apps/patient-app/mock/medical-aid/index.ts
export * from './types';
export * from './by-country';

import { MEDICAL_AIDS_BY_COUNTRY } from './by-country';
import type { MedicalAidPlan } from './types';

export const MEDICAL_AIDS: MedicalAidPlan[] = MEDICAL_AIDS_BY_COUNTRY.ZA ?? [];

export function getMockMedicalAidsForCountry(countryCode: string): MedicalAidPlan[] {
  const c = String(countryCode || '').toUpperCase();
  return MEDICAL_AIDS_BY_COUNTRY[c] ?? MEDICAL_AIDS_BY_COUNTRY.ZA ?? [];
}
