// apps/patient-app/mock/selfcheck.ts
export type Thresholds = {
  hr: { min: number; max: number };
  spo2: { min: number; max: number };
  sys: { min: number; max: number };
  dia: { min: number; max: number };
  repeatDays: number; // successive days to prompt see doctor
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  hr:   { min: 50, max: 100 },
  spo2: { min: 94, max: 100 },
  sys:  { min: 95, max: 140 },
  dia:  { min: 60, max: 90 },
  repeatDays: 3,
};
