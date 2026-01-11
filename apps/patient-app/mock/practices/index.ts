// apps/patient-app/mock/practices/index.ts

export * from './types';

// Import all country practice lists
import PRACTICES_ZA from './ZA';
import PRACTICES_NG from './NG';
import PRACTICES_KE from './KE';
import PRACTICES_GH from './GH';
import PRACTICES_BW from './BW';
import PRACTICES_ZW from './ZW';
import PRACTICES_CD from './CD';
import PRACTICES_BR from './BR';
import PRACTICES_AR from './AR';
import PRACTICES_NZ from './NZ';
import PRACTICES_GB from './GB';
import PRACTICES_US from './US';
import PRACTICES_CA from './CA';
import PRACTICES_AE from './AE';
import PRACTICES_SA from './SA';
import PRACTICES_AU from './AU';
import PRACTICES_CU from './CU';
import PRACTICES_SG from './SG';
import PRACTICES_JM from './JM';
import PRACTICES_DM from './DM';

// Map all countries
export const PRACTICES_BY_COUNTRY: Record<string, any> = {
  ZA: PRACTICES_ZA,
  NG: PRACTICES_NG,
  KE: PRACTICES_KE,
  GH: PRACTICES_GH,
  BW: PRACTICES_BW,
  ZW: PRACTICES_ZW,
  CD: PRACTICES_CD,
  BR: PRACTICES_BR,
  AR: PRACTICES_AR,
  NZ: PRACTICES_NZ,
  GB: PRACTICES_GB,
  US: PRACTICES_US,
  CA: PRACTICES_CA,
  AE: PRACTICES_AE,
  SA: PRACTICES_SA,
  AU: PRACTICES_AU,
  CU: PRACTICES_CU,
  SG: PRACTICES_SG,
  JM: PRACTICES_JM,
  DM: PRACTICES_DM,
};

// Helper to get practices dynamically
export function getMockPracticesForCountry(countryCode: string) {
  return PRACTICES_BY_COUNTRY[countryCode.toUpperCase()];
}

// ✅ Back-compat: old code
export const PRACTICES = PRACTICES_BY_COUNTRY.ZA;
