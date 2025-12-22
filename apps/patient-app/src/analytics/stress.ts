// apps/patient-app/src/analytics/stress.ts

/**
 * computeStressIndex
 *
 * Primary intended input: HRV (heart-rate variability) in ms (or scaled units).
 * For backwards compatibility and devices/users without HRV, this function may accept
 * a Resting Heart Rate (RHR) via inputType = 'rhr' — in that case a conservative
 * surrogate HRV mapping is applied (documented below).
 *
 * Signature:
 *   computeStressIndex(value: number, daytimeStressLevel: number, mindfulnessMinutes: number, opts?: { inputType?: 'hrv'|'rhr' })
 *
 * - If inputType === 'hrv' (default) the 'value' is treated as HRV (higher HRV => lower stress).
 * - If inputType === 'rhr' the 'value' is treated as resting heart rate (RHR). RHR is mapped
 *   to a surrogate HRV for the index using a conservative heuristic (NOT diagnostic).
 *
 * Returns: { index: number (0-100), label: 'Low Stress'|'Moderate Stress'|'High Stress' }
 */

export function computeStressIndex(
  value: number,
  daytimeStressLevel: number, // 0–100
  mindfulnessMinutes: number,
  opts?: { inputType?: 'hrv' | 'rhr' }
): { index: number; label: string } {
  const inputType = opts?.inputType ?? 'hrv';

  // Determine HRV to use in formula.
  // If HRV is provided, use directly; otherwise map resting HR -> surrogate HRV.
  let hrv = 50; // neutral baseline
  if (inputType === 'hrv') {
    hrv = typeof value === 'number' && Number.isFinite(value) ? value : 50;
    // clamp to 0–100 to keep index interpretable
    hrv = Math.max(0, Math.min(100, hrv));
  } else {
    // inputType === 'rhr' (resting heart rate)
    // Heuristic mapping (conservative): lower RHR generally correlates with higher HRV.
    // This is a rough transformation for environments where HRV is unavailable.
    // Mapping chosen so RHR 40 -> surrogate HRV ~ 90, RHR 60 -> ~70, RHR 80 -> ~50, RHR 100 -> ~30
    const r = typeof value === 'number' && Number.isFinite(value) ? value : 70;
    const surrogate = 100 - Math.max(0, Math.min(60, r - 40)) * (60 / 60); // linear 40..100 -> 100..40 approx
    hrv = Math.max(10, Math.min(100, Math.round(surrogate)));
  }

  // Stress index formula (preserve existing style: higher index == more stress)
  // Existing formula: 100 - hrv + daytimeStressLevel - mindfulnessMinutes * 0.5
  let index = 100 - hrv + (typeof daytimeStressLevel === 'number' ? daytimeStressLevel : 30) - (typeof mindfulnessMinutes === 'number' ? mindfulnessMinutes * 0.5 : 0);
  index = Math.max(0, Math.min(100, Math.round(index)));

  if (index > 70) return { index, label: 'High Stress' };
  if (index > 40) return { index, label: 'Moderate Stress' };
  return { index, label: 'Low Stress' };
}

/**
 * Simple aggregator used by reports: average & clamp to 0–100.
 */
export function stressIndex(scores: number[]): number {
  const vals = (scores ?? []).filter(Number.isFinite) as number[];
  if (!vals.length) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}
