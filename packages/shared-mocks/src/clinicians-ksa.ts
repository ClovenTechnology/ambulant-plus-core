// apps/patient-app/mock/clinicians-ksa.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_KSA = { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', timezone: 'Asia/Riyadh' };

export const CLINICIANS_KSA: Clinician[] = buildCliniciansForCountry({
  seed: 'SA-ksa-v1',
  countryCode: 'SA',
  countryName: 'Saudi Arabia',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  nameStyle: 'middle_east',
  cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar'],
  languages: ['Arabic', 'English', 'Urdu', 'Hindi'],
  basePriceCents: { doctor: 42000, allied: 30000, wellness: 22000 },
});

export default CLINICIANS_KSA;
