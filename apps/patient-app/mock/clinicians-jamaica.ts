// apps/patient-app/mock/clinicians-jamaica.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_JAMAICA = { code: 'JM', name: 'Jamaica', currency: 'JMD', timezone: 'America/Jamaica' };

export const CLINICIANS_JAMAICA: Clinician[] = buildCliniciansForCountry({
  seed: 'JM-jamaica-v1',
  countryCode: 'JM',
  countryName: 'Jamaica',
  currency: 'JMD',
  timezone: 'America/Jamaica',
  nameStyle: 'caribbean',
  cities: ['Kingston', 'Montego Bay', 'Ocho Rios', 'Negril', 'Spanish Town', 'Portmore'],
  languages: ['English', 'Jamaican Patois'],
  basePriceCents: { doctor: 140000, allied: 100000, wellness: 75000 },
});

export default CLINICIANS_JAMAICA;
