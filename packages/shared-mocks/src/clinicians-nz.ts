// apps/patient-app/mock/clinicians-nz.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_NZ = { code: 'NZ', name: 'New Zealand', currency: 'NZD', timezone: 'Pacific/Auckland' };

export const CLINICIANS_NZ: Clinician[] = buildCliniciansForCountry({
  seed: 'NZ-newzealand-v1',
  countryCode: 'NZ',
  countryName: 'New Zealand',
  currency: 'NZD',
  timezone: 'Pacific/Auckland',
  nameStyle: 'anglosphere',
  cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin'],
  languages: ['English', 'Māori'],
  basePriceCents: { doctor: 18000, allied: 14000, wellness: 11000 },
});

export default CLINICIANS_NZ;
