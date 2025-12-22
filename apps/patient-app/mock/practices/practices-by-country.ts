// apps/patient-app/mock/practices/practices-by-country.ts
import type { Practice } from './types';
import type { CountryCode } from '../clinicians-shared';

import ZA from './ZA';
import NG from './NG';
import KE from './KE';
import GH from './GH';
import BW from './BW';
import ZW from './ZW';
import CD from './CD';
import BR from './BR';
import AR from './AR';
import NZ from './NZ';
import GB from './GB';
import US from './US';
import CA from './CA';
import AE from './AE';
import SA from './SA';
import AU from './AU';
import CU from './CU';
import SG from './SG';
import JM from './JM';
import DM from './DM';

export const PRACTICES_BY_COUNTRY = {
  ZA,
  NG,
  KE,
  GH,
  BW,
  ZW,
  CD,
  BR,
  AR,
  NZ,
  GB,
  US,
  CA,
  AE,
  SA,
  AU,
  CU,
  SG,
  JM,
  DM,
} as const;

type SupportedCountry = keyof typeof PRACTICES_BY_COUNTRY;

function normalizeCountry(input: unknown): SupportedCountry {
  const raw = String(input ?? '').trim().toUpperCase();
  if (raw && raw in PRACTICES_BY_COUNTRY) return raw as SupportedCountry;
  return 'ZA';
}

/**
 * Back-compat helper: returns the raw list.
 * Accepts CountryCode but also tolerates unknown strings safely.
 */
export function getMockPracticesForCountry(country: CountryCode | string): Practice[] {
  const code = normalizeCountry(country);
  return (PRACTICES_BY_COUNTRY[code] ?? PRACTICES_BY_COUNTRY.ZA ?? []) as Practice[];
}

/**
 * ✅ API-shaped mock response that mirrors `/api/practices?country=XX`
 * so the frontend + future API can stay aligned.
 */
export type MockPracticesApiResponse = {
  country: string;
  practices: Practice[];
  source: 'mock';
};

export function getMockPracticesApiResponse(country: CountryCode | string): MockPracticesApiResponse {
  const code = normalizeCountry(country);
  return {
    country: code,
    practices: getMockPracticesForCountry(code),
    source: 'mock',
  };
}
