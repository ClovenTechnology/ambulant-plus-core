// apps/clinician-app/src/components/workspaces/std/constants.ts

export const CONTEXTS = [
  { key: 'screening', label: 'Screening' },
  { key: 'symptomatic', label: 'Symptomatic' },
  { key: 'follow_up', label: 'Follow-up' },
] as const;

export type ContextKey = (typeof CONTEXTS)[number]['key'];

export const FINDING_TYPES = [
  { key: 'risk_assessment', label: 'Risk assessment' },
  { key: 'exposure_history', label: 'Exposure history' },

  { key: 'genital_symptoms', label: 'Symptoms reported (genital/urogenital)' },
  { key: 'urinary_symptoms', label: 'Symptoms reported (urinary)' },
  { key: 'systemic_symptoms', label: 'Symptoms reported (systemic)' },
  { key: 'throat_findings', label: 'Throat findings' },
  { key: 'rectal_symptoms', label: 'Rectal symptoms' },

  { key: 'lesion_observed', label: 'Finding observed: lesion' },
  { key: 'discharge_observed', label: 'Finding observed: discharge' },
  { key: 'rash_observed', label: 'Finding observed: rash' },
  { key: 'pelvic_pain', label: 'Pelvic pain reported' },
  { key: 'testicular_pain', label: 'Testicular pain reported' },

  { key: 'pregnancy_related', label: 'Pregnancy-related consideration' },

  { key: 'tests_ordered', label: 'Tests ordered / planned' },
  { key: 'results_review', label: 'Results review / interpretation' },

  { key: 'treatment_given', label: 'Treatment provided' },
  { key: 'partner_notification', label: 'Partner notification / counselling' },
  { key: 'prevention_counselling', label: 'Prevention counselling / education' },
  { key: 'follow_up_plan', label: 'Follow-up plan / safety net advice' },
  { key: 'consent_documented', label: 'Consent documented' },

  { key: 'other', label: 'Other' },
] as const;

export type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];
