// apps/patient-app/mock/clinicians-dominica.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_DOMINICA = { code: 'DM', name: 'Dominica', currency: 'XCD', timezone: 'America/Dominica' };

export const CLINICIANS_DOMINICA: Clinician[] = buildCliniciansForCountry({
  seed: 'DM-dominica-v1',
  countryCode: 'DM',
  countryName: 'Dominica',
  currency: 'XCD',
  timezone: 'America/Dominica',
  nameStyle: 'caribbean',
  cities: ['Roseau', 'Portsmouth', 'Marigot', 'Castle Bruce', 'La Plaine', 'Mahaut'],
  languages: ['English', 'Kwéyòl (Antillean Creole)'],
  basePriceCents: { doctor: 12000, allied: 9000, wellness: 7000 },
  counts: { doctors: 14, allied: 10, wellness: 8 },
});

export default CLINICIANS_DOMINICA;
