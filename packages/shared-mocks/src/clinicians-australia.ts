// apps/patient-app/mock/clinicians-australia.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_AUSTRALIA = { code: 'AU', name: 'Australia', currency: 'AUD', timezone: 'Australia/Sydney' };

export const CLINICIANS_AUSTRALIA: Clinician[] = buildCliniciansForCountry({
  seed: 'AU-australia-v1',
  countryCode: 'AU',
  countryName: 'Australia',
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  nameStyle: 'anglosphere',
  cities: ['Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA', 'Canberra, ACT'],
  languages: ['English', 'Mandarin', 'Arabic', 'Hindi'],
  basePriceCents: { doctor: 17000, allied: 13000, wellness: 10000 },
});

export default CLINICIANS_AUSTRALIA;
