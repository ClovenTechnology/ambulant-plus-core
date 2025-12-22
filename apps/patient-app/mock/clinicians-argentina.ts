// apps/patient-app/mock/clinicians-argentina.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_ARGENTINA = { code: 'AR', name: 'Argentina', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' };

export const CLINICIANS_ARGENTINA: Clinician[] = buildCliniciansForCountry({
  seed: 'AR-argentina-v1',
  countryCode: 'AR',
  countryName: 'Argentina',
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  nameStyle: 'latam',
  cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata'],
  languages: ['Español', 'English', 'Português'],
  basePriceCents: { doctor: 220000, allied: 160000, wellness: 120000 },
});

export default CLINICIANS_ARGENTINA;
