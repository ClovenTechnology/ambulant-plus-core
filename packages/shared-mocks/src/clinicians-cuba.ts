// apps/patient-app/mock/clinicians-cuba.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_CUBA = { code: 'CU', name: 'Cuba', currency: 'CUP', timezone: 'America/Havana' };

export const CLINICIANS_CUBA: Clinician[] = buildCliniciansForCountry({
  seed: 'CU-cuba-v1',
  countryCode: 'CU',
  countryName: 'Cuba',
  currency: 'CUP',
  timezone: 'America/Havana',
  nameStyle: 'latam',
  cities: ['Havana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Santa Clara', 'Matanzas'],
  languages: ['Español', 'English'],
  basePriceCents: { doctor: 8000, allied: 6000, wellness: 4500 },
});

export default CLINICIANS_CUBA;
