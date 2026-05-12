// apps/patient-app/mock/clinicians-brazil.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_BRAZIL = { code: 'BR', name: 'Brazil', currency: 'BRL', timezone: 'America/Sao_Paulo' };

export const CLINICIANS_BRAZIL: Clinician[] = buildCliniciansForCountry({
  seed: 'BR-brazil-v1',
  countryCode: 'BR',
  countryName: 'Brazil',
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
  nameStyle: 'latam',
  cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Belo Horizonte', 'Recife'],
  languages: ['Português', 'English', 'Español'],
  basePriceCents: { doctor: 30000, allied: 22000, wellness: 16000 },
});

export default CLINICIANS_BRAZIL;
