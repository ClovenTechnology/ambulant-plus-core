// apps/patient-app/src/analytics/fertility.ts

export type FertilityPhase =
  | 'follicular'
  | 'ovulation'
  | 'luteal'
  | 'period'
  | 'uncertain';

export interface FertilityStatus {
  phase: FertilityPhase;
  confidence: number; // 0–1
  reasoning: string;  // optional explanation (useful for debug/clinician)
}

/**
 * Multi-month fertility analysis using:
 * - Temp variation (NexRing nightly)
 * - HRV (lower dips near ovulation)
 * - RHR (tends to rise in luteal phase)
 * - Manual logs (highest priority if present)
 */
export function getFertilityStatus(
  temps: number[],    // nightly temp variations (baseline normalized)
  hrv: number[],      // nightly HRV
  rhr: number[],      // nightly resting HR
  baseline: number,   // user’s computed baseline temp
  manual?: { period?: boolean; ovulation?: boolean } // logs override
): FertilityStatus {
  // Manual logs take priority
  if (manual?.period) {
    return { phase: 'period', confidence: 0.95, reasoning: 'Confirmed by user log' };
  }
  if (manual?.ovulation) {
    return { phase: 'ovulation', confidence: 0.95, reasoning: 'Confirmed by user log' };
  }

  // Require at least ~3 cycles (~90 days) for high confidence
  const window = Math.min(temps.length, 90);
  if (window < 14) {
    return { phase: 'uncertain', confidence: 0.2, reasoning: 'Insufficient data' };
  }

  const recentTemps = temps.slice(-window);
  const recentHRV = hrv.slice(-window);
  const recentRHR = rhr.slice(-window);

  const avgBase = temps.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  const lastTemp = recentTemps[recentTemps.length - 1];
  const delta = lastTemp - avgBase;

  // HRV dip (near ovulation)
  const hrvTrend = recentHRV[recentHRV.length - 1] - recentHRV[0];
  // RHR rise (luteal)
  const rhrTrend = recentRHR[recentRHR.length - 1] - recentRHR[0];

  // Detect luteal (temp higher + RHR rise)
  if (delta > 0.3 && rhrTrend > 2) {
    return {
      phase: 'luteal',
      confidence: 0.85,
      reasoning: 'Temp elevated + RHR increased',
    };
  }

  // Detect ovulation (small temp shift + HRV dip)
  if (Math.abs(delta) < 0.1 && hrvTrend < -5) {
    return {
      phase: 'ovulation',
      confidence: 0.75,
      reasoning: 'Stable temp + HRV dip',
    };
  }

  // Detect follicular (baseline temp, stable HRV/RHR)
  if (delta <= 0.2) {
    return {
      phase: 'follicular',
      confidence: 0.6,
      reasoning: 'Temp near baseline',
    };
  }

  return { phase: 'uncertain', confidence: 0.3, reasoning: 'No clear pattern' };
}
