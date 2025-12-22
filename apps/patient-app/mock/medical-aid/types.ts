// apps/patient-app/mock/medical-aid/types.ts

export type CoverKind = 'public' | 'medical_aid' | 'hmo' | 'insurer' | 'other';

export type MedicalAidPlan = {
  id: string;
  name: string;
  tiers: string[];

  // optional metadata (won’t break existing consumers)
  countryCode?: string;
  kind?: CoverKind;
};
