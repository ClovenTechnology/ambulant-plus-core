// apps/patient-app/mock/clinicians-botswana.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_BOTSWANA = { code: 'BW', name: 'Botswana', currency: 'BWP', timezone: 'Africa/Gaborone' };

export const CLINICIANS_BOTSWANA: Clinician[] = buildCliniciansForCountry({
  seed: 'BW-botswana-v1',
  countryCode: 'BW',
  countryName: 'Botswana',
  currency: 'BWP',
  timezone: 'Africa/Gaborone',
  nameStyle: 'southern_africa',
  cities: ['Gaborone', 'Francistown', 'Maun', 'Kasane', 'Lobatse', 'Selebi-Phikwe'],
  languages: ['English', 'Setswana'],
  basePriceCents: { doctor: 52000, allied: 39000, wellness: 30000 },
});

export default CLINICIANS_BOTSWANA;
