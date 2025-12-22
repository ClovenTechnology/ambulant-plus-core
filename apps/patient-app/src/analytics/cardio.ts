// apps/patient-app/src/analytics/cardio.ts
// Cardiovascular insights from Health Monitor vitals

function avg(arr: number[]) {
  if (!Array.isArray(arr) || arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * computeCardioRisk
 *
 * - systolic: number[] | number (required)
 * - diastolic: number[] | number (optional) — **no longer inferred** from systolic.
 * - restingHR, spo2: optional supportive signals.
 * - systolicHistory?: number[] (optional) — recent historical systolic readings (e.g., last 3–7 checks).
 *
 * Returns conservative, non-diagnostic guidance.
 *
 * NOTE: If diastolic readings are missing (no numeric diastolic provided),
 * the function will return a helpful message rather than silently inferring values.
 */
export function computeCardioRisk(
  systolic: number[] | number,
  diastolic?: number[] | number,
  restingHR?: number,
  spo2?: number,
  systolicHistory?: number[] // optional persistence-based checks
): { risk: 'low' | 'moderate' | 'high'; notes: string } {
  // normalize inputs to arrays
  const sArr = Array.isArray(systolic)
    ? systolic.filter(Number.isFinite)
    : Number.isFinite(Number(systolic))
    ? [Number(systolic)]
    : [];

  const dArr = Array.isArray(diastolic)
    ? diastolic.filter(Number.isFinite)
    : Number.isFinite(Number(diastolic))
    ? [Number(diastolic)]
    : [];

  const avgSys = avg(sArr);
  const avgDia = avg(dArr);

  // safe fallbacks for other signals
  const hr = typeof restingHR === 'number' ? restingHR : NaN;
  const o2 = typeof spo2 === 'number' ? spo2 : NaN;

  // If diastolic data is missing, do not infer — explicitly report inability to fully compute
  if (Number.isNaN(avgDia)) {
    // If we have persistence evidence of multiple elevated systolic readings we can still raise a concern
    if (Array.isArray(systolicHistory) && systolicHistory.length > 0) {
      const elevatedCount = systolicHistory.filter((v) => Number.isFinite(v) && v > 140).length;
      // If 3 or more elevated readings in the recent window, flag high risk based on persistent systolic elevation
      if (elevatedCount >= 3) {
        return {
          risk: 'high',
          notes:
            'Multiple recent elevated systolic readings detected. Diastolic missing — provide diastolic values for full assessment; consult clinician.',
        };
      }
    }

    return {
      risk: 'moderate',
      notes: 'Unable to compute full cardiovascular risk — diastolic readings missing. Provide diastolic values for complete assessment.',
    };
  }

  // decision rules (conservative, non-diagnostic)
  // Use both systolic and diastolic if available
  if (!Number.isNaN(avgSys) && !Number.isNaN(avgDia) && (avgSys > 140 || avgDia > 90)) {
    return { risk: 'high', notes: 'Elevated blood pressure — monitor and discuss with clinician' };
  }

  // persistence-based check (if provided) to detect repeated systolic elevation even when diastolic is present
  if (Array.isArray(systolicHistory) && systolicHistory.length > 0) {
    const elevatedCount = systolicHistory.filter((v) => Number.isFinite(v) && v > 140).length;
    const window = systolicHistory.length;
    // If a majority or >=3 of recent checks show elevated systolic, escalate
    if (elevatedCount >= 3 || elevatedCount / window >= 0.5) {
      return {
        risk: 'high',
        notes: 'Multiple recent elevated systolic readings — sustained hypertension likely; consult clinician.',
      };
    }
  }

  if ((!Number.isNaN(hr) && hr > 100) || (!Number.isNaN(o2) && o2 < 92)) {
    return { risk: 'moderate', notes: 'Elevated heart rate or low oxygen saturation detected — consider evaluation' };
  }

  return { risk: 'low', notes: 'Cardiovascular signals appear stable' };
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
