// apps/patient-app/mock/practices/types.ts

export type PracticeKind = 'team' | 'clinic' | 'hospital';
export type PlanTier = 'free' | 'basic' | 'pro' | 'host';

export type Practice = {
  id: string;
  kind: PracticeKind;
  name: string;
  subType: string;
  location: string; // "City, Region"
  rating: number; // 0..5
  ratingCount: number;
  priceFromZAR: number; // current UI expects ZAR-normalized number
  acceptsMedicalAid: boolean;
  acceptedSchemes?: string[];
  planTier: PlanTier;
  hasEncounter?: boolean;
  lastEncounterAt?: string | null;
  encounterCount?: number;
};

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
