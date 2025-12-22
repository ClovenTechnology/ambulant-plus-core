// apps/patient-app/mock/clinicians-usa.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_USA = { code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York' };

export const CLINICIANS_USA: Clinician[] = buildCliniciansForCountry({
  seed: 'US-usa-v1',
  countryCode: 'US',
  countryName: 'United States',
  currency: 'USD',
  timezone: 'America/New_York',
  nameStyle: 'anglosphere',
  cities: ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Miami, FL', 'Seattle, WA'],
  languages: ['English', 'Spanish', 'French', 'Arabic', 'Mandarin'],
  basePriceCents: { doctor: 18000, allied: 14000, wellness: 11000 },
});

export default CLINICIANS_USA;
