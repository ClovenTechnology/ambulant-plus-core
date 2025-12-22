// apps/patient-app/mock/clinicians-uae.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_UAE = { code: 'AE', name: 'United Arab Emirates', currency: 'AED', timezone: 'Asia/Dubai' };

export const CLINICIANS_UAE: Clinician[] = buildCliniciansForCountry({
  seed: 'AE-uae-v1',
  countryCode: 'AE',
  countryName: 'United Arab Emirates',
  currency: 'AED',
  timezone: 'Asia/Dubai',
  nameStyle: 'middle_east',
  cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Al Ain'],
  languages: ['Arabic', 'English', 'Hindi', 'Urdu'],
  basePriceCents: { doctor: 45000, allied: 32000, wellness: 24000 },
});

export default CLINICIANS_UAE;
