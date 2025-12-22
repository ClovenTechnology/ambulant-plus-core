// apps/patient-app/mock/clinicians-zimbabwe.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

// NOTE: Zimbabwe uses multiple currencies in practice; for mocks, USD keeps UI sane.
export const COUNTRY_ZIMBABWE = { code: 'ZW', name: 'Zimbabwe', currency: 'USD', timezone: 'Africa/Harare' };

export const CLINICIANS_ZIMBABWE: Clinician[] = buildCliniciansForCountry({
  seed: 'ZW-zimbabwe-v1',
  countryCode: 'ZW',
  countryName: 'Zimbabwe',
  currency: 'USD',
  timezone: 'Africa/Harare',
  nameStyle: 'southern_africa',
  cities: ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Victoria Falls'],
  languages: ['English', 'Shona', 'Ndebele'],
  basePriceCents: { doctor: 6500, allied: 4500, wellness: 3500 },
});

export default CLINICIANS_ZIMBABWE;
