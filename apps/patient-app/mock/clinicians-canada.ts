// apps/patient-app/mock/clinicians-canada.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_CANADA = { code: 'CA', name: 'Canada', currency: 'CAD', timezone: 'America/Toronto' };

export const CLINICIANS_CANADA: Clinician[] = buildCliniciansForCountry({
  seed: 'CA-canada-v1',
  countryCode: 'CA',
  countryName: 'Canada',
  currency: 'CAD',
  timezone: 'America/Toronto',
  nameStyle: 'anglosphere',
  cities: ['Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB', 'Ottawa, ON', 'Halifax, NS'],
  languages: ['English', 'French', 'Punjabi', 'Arabic'],
  basePriceCents: { doctor: 16000, allied: 12000, wellness: 9500 },
});

export default CLINICIANS_CANADA;
