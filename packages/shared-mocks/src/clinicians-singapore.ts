// apps/patient-app/mock/clinicians-singapore.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_SINGAPORE = { code: 'SG', name: 'Singapore', currency: 'SGD', timezone: 'Asia/Singapore' };

export const CLINICIANS_SINGAPORE: Clinician[] = buildCliniciansForCountry({
  seed: 'SG-singapore-v1',
  countryCode: 'SG',
  countryName: 'Singapore',
  currency: 'SGD',
  timezone: 'Asia/Singapore',
  nameStyle: 'asia_pacific',
  cities: ['Orchard', 'Novena', 'Toa Payoh', 'Bukit Timah', 'Bedok', 'Jurong East'],
  languages: ['English', '中文', 'Bahasa Melayu', 'தமிழ்'],
  basePriceCents: { doctor: 22000, allied: 16000, wellness: 12000 },
});

export default CLINICIANS_SINGAPORE;
