//apps/patient-app/mock/clinicians-nigeria.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_NIGERIA = { code: 'NG', name: 'Nigeria', currency: 'NGN', timezone: 'Africa/Lagos' };

export const CLINICIANS_NIGERIA: Clinician[] = buildCliniciansForCountry({
  seed: 'NG-nigeria-v1',
  countryCode: 'NG',
  countryName: 'Nigeria',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  nameStyle: 'west_africa',
  cities: ['Lagos', 'Abuja', 'Kano', 'Port Harcourt', 'Ibadan', 'Enugu'],
  languages: ['English', 'Yorùbá', 'Igbo', 'Hausa', 'Pidgin English'],
  basePriceCents: { doctor: 900000, allied: 650000, wellness: 450000 }, // mock
});

export default CLINICIANS_NIGERIA;
