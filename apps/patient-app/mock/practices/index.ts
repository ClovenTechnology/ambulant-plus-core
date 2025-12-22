// apps/patient-app/mock/practices/index.ts

export * from './types';
export * from './practices-by-country';

export { default as PRACTICES_ZA } from './ZA';
export { default as PRACTICES_NG } from './NG';
export { default as PRACTICES_KE } from './KE';
export { default as PRACTICES_GH } from './GH';
export { default as PRACTICES_BW } from './BW';
export { default as PRACTICES_ZW } from './ZW';
export { default as PRACTICES_CD } from './CD';
export { default as PRACTICES_BR } from './BR';
export { default as PRACTICES_AR } from './AR';
export { default as PRACTICES_NZ } from './NZ';
export { default as PRACTICES_GB } from './GB';
export { default as PRACTICES_US } from './US';
export { default as PRACTICES_CA } from './CA';
export { default as PRACTICES_AE } from './AE';
export { default as PRACTICES_SA } from './SA';
export { default as PRACTICES_AU } from './AU';
export { default as PRACTICES_CU } from './CU';
export { default as PRACTICES_SG } from './SG';
export { default as PRACTICES_JM } from './JM';
export { default as PRACTICES_DM } from './DM';

// ✅ Back-compat: existing code imports { PRACTICES } from '@/mock/practices'
export { default as PRACTICES } from './ZA';
