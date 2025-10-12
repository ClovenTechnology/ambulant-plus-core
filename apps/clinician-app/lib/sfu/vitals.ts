// Normalize vitals data from multiple source schemas
export type NormalizedVitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
  [k: string]: any;
};

export function normalizeVitals(raw: any): NormalizedVitals {
  const sys = raw?.sys ?? raw?.bpSys ?? raw?.sbp ?? raw?.bp?.sys;
  const dia = raw?.dia ?? raw?.bpDia ?? raw?.dbp ?? raw?.bp?.dia;
  return { ...raw, sys, dia };
}
