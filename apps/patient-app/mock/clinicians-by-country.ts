// apps/patient-app/mock/clinicians-by-country.ts
import type { Clinician } from './clinicians.factory';

import RSA from './clinicians-rsa';
import NIGERIA from './clinicians-nigeria';
import KENYA from './clinicians-kenya';
import GHANA from './clinicians-ghana';
import BOTSWANA from './clinicians-botswana';
import ZIMBABWE from './clinicians-zimbabwe';
import DRC from './clinicians-drc';
import BRAZIL from './clinicians-brazil';
import ARGENTINA from './clinicians-argentina';
import NZ from './clinicians-nz';
import UK from './clinicians-uk';
import USA from './clinicians-usa';
import CANADA from './clinicians-canada';
import UAE from './clinicians-uae';
import KSA from './clinicians-ksa';
import AUSTRALIA from './clinicians-australia';
import CUBA from './clinicians-cuba';
import SINGAPORE from './clinicians-singapore';
import JAMAICA from './clinicians-jamaica';
import DOMINICA from './clinicians-dominica';

export const CLINICIANS_BY_COUNTRY: Record<string, Clinician[]> = {
  ZA: RSA,
  NG: NIGERIA,
  KE: KENYA,
  GH: GHANA,
  BW: BOTSWANA,
  ZW: ZIMBABWE,
  CD: DRC,
  BR: BRAZIL,
  AR: ARGENTINA,
  NZ: NZ,
  GB: UK,
  US: USA,
  CA: CANADA,
  AE: UAE,
  SA: KSA,
  AU: AUSTRALIA,
  CU: CUBA,
  SG: SINGAPORE,
  JM: JAMAICA,
  DM: DOMINICA,
};

export const COUNTRY_OPTIONS = [
  { code: 'ZA', label: 'South Africa' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'KE', label: 'Kenya' },
  { code: 'GH', label: 'Ghana' },
  { code: 'BW', label: 'Botswana' },
  { code: 'ZW', label: 'Zimbabwe' },
  { code: 'CD', label: 'DRC' },
  { code: 'BR', label: 'Brazil' },
  { code: 'AR', label: 'Argentina' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'AE', label: 'UAE' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'AU', label: 'Australia' },
  { code: 'CU', label: 'Cuba' },
  { code: 'SG', label: 'Singapore' },
  { code: 'JM', label: 'Jamaica' },
  { code: 'DM', label: 'Dominica' },
] as const;

export type CountryCode = (typeof COUNTRY_OPTIONS)[number]['code'];

export const COUNTRY_LABELS: Record<CountryCode, string> = COUNTRY_OPTIONS.reduce(
  (acc, it) => {
    acc[it.code] = it.label;
    return acc;
  },
  {} as Record<CountryCode, string>,
);

export function getMockCliniciansForCountry(country: CountryCode): Clinician[] {
  return CLINICIANS_BY_COUNTRY[country] ?? CLINICIANS_BY_COUNTRY.ZA ?? [];
}
