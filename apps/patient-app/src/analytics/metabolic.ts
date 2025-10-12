// apps/patient-app/src/analytics/metabolic.ts
// Glucose variability + readiness scoring

export function computeGlucoseStability(
  glucoseReadings: number[]
): { stability: 'stable' | 'variable'; notes: string } {
  if (glucoseReadings.length < 2) return { stability: 'stable', notes: 'Insufficient data' };

  const diffs = glucoseReadings.slice(1).map((v, i) => Math.abs(v - glucoseReadings[i]));
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

  return avgDiff > 20
    ? { stability: 'variable', notes: 'Large glucose swings' }
    : { stability: 'stable', notes: 'Controlled glucose profile' };
}
