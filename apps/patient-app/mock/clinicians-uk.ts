// apps/patient-app/mock/clinicians-uk.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_UK = { code: 'GB', name: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London' };

export const CLINICIANS_UK: Clinician[] = buildCliniciansForCountry({
  seed: 'GB-uk-v1',
  countryCode: 'GB',
  countryName: 'United Kingdom',
  currency: 'GBP',
  timezone: 'Europe/London',
  nameStyle: 'europe',
  cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Bristol'],
  languages: ['English', 'Welsh', 'Scottish Gaelic', 'Polish', 'Punjabi'],
  basePriceCents: { doctor: 12000, allied: 9000, wellness: 7000 },
});

export default CLINICIANS_UK;
