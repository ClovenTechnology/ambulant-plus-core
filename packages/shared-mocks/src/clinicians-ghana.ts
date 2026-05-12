// apps/patient-app/mock/clinicians-ghana.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_GHANA = { code: 'GH', name: 'Ghana', currency: 'GHS', timezone: 'Africa/Accra' };

export const CLINICIANS_GHANA: Clinician[] = buildCliniciansForCountry({
  seed: 'GH-ghana-v1',
  countryCode: 'GH',
  countryName: 'Ghana',
  currency: 'GHS',
  timezone: 'Africa/Accra',
  nameStyle: 'west_africa',
  cities: ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Tema'],
  languages: ['English', 'Twi', 'Ga', 'Ewe', 'Dagbani'],
  basePriceCents: { doctor: 70000, allied: 52000, wellness: 38000 },
});

export default CLINICIANS_GHANA;
