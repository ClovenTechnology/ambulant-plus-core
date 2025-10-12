// apps/patient-app/src/analytics/stress.ts

// Existing API preserved
export function computeStressIndex(
  hrv: number,
  daytimeStressLevel: number, // 0–100
  mindfulnessMinutes: number
): { index: number; label: string } {
  let index = 100 - hrv + daytimeStressLevel - mindfulnessMinutes * 0.5;
  index = Math.max(0, Math.min(100, index));

  if (index > 70) return { index, label: 'High Stress' };
  if (index > 40) return { index, label: 'Moderate Stress' };
  return { index, label: 'Low Stress' };
}

/**
 * Simple aggregate for reports — average & clamp to 0–100.
 * Matches the signature expected by reports/stressReport.ts
 */
export function stressIndex(scores: number[]): number {
  const vals = (scores ?? []).filter(Number.isFinite) as number[];
  if (!vals.length) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}
