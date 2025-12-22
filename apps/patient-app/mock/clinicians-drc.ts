// apps/patient-app/mock/clinicians-drc.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_DRC = { code: 'CD', name: 'DRC', currency: 'CDF', timezone: 'Africa/Kinshasa' };

export const CLINICIANS_DRC: Clinician[] = buildCliniciansForCountry({
  seed: 'CD-drc-v1',
  countryCode: 'CD',
  countryName: 'DRC',
  currency: 'CDF',
  timezone: 'Africa/Kinshasa',
  nameStyle: 'central_africa',
  cities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani', 'Bukavu', 'Matadi'],
  languages: ['French', 'Lingala', 'Swahili', 'Kikongo', 'Tshiluba'],
  basePriceCents: { doctor: 180000, allied: 130000, wellness: 90000 },
});

export default CLINICIANS_DRC;
