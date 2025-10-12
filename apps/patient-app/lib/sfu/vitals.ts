// Normalize vitals data from multiple source schemas
export function normalizeVitals(raw: any) {
  const sys = raw?.sys ?? raw?.bpSys ?? raw?.sbp ?? raw?.bp?.sys;
  const dia = raw?.dia ?? raw?.bpDia ?? raw?.dbp ?? raw?.bp?.dia;
  return { ...raw, sys, dia };
}
