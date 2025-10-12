// apps/patient-app/src/analytics/cardio.ts
// Cardiovascular insights from Health Monitor vitals

export function computeCardioRisk(
  systolic: number[],
  diastolic: number[],
  restingHR: number,
  spo2: number
): { risk: 'low' | 'moderate' | 'high'; notes: string } {
  const avgSys = systolic.reduce((a, b) => a + b, 0) / systolic.length;
  const avgDia = diastolic.reduce((a, b) => a + b, 0) / diastolic.length;

  if (avgSys > 140 || avgDia > 90) {
    return { risk: 'high', notes: 'Hypertension risk' };
  }
  if (restingHR > 100 || spo2 < 92) {
    return { risk: 'moderate', notes: 'Possible arrhythmia or hypoxia' };
  }
  return { risk: 'low', notes: 'Stable cardiovascular state' };
}

// NEW: simple hypertension index for reports (0–100)
export function hypertensionIndex(systolic: number[]): number {
  const vals = (systolic ?? []).filter((n) => Number.isFinite(n)) as number[];
  if (!vals.length) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Map 110–180 mmHg -> 10–100; clamp
  const idx = Math.round(((avg - 110) / (180 - 110)) * 90 + 10);
  return Math.max(0, Math.min(100, idx));
}
