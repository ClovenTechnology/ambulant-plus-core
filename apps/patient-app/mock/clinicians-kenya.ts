// apps/patient-app/mock/clinicians-kenya.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_KENYA = { code: 'KE', name: 'Kenya', currency: 'KES', timezone: 'Africa/Nairobi' };

export const CLINICIANS_KENYA: Clinician[] = buildCliniciansForCountry({
  seed: 'KE-kenya-v1',
  countryCode: 'KE',
  countryName: 'Kenya',
  currency: 'KES',
  timezone: 'Africa/Nairobi',
  nameStyle: 'east_africa',
  cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika'],
  languages: ['English', 'Kiswahili', 'Kikuyu', 'Luo', 'Kalenjin'],
  basePriceCents: { doctor: 80000, allied: 60000, wellness: 45000 },
});

export default CLINICIANS_KENYA;
