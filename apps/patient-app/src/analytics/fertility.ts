// apps/patient-app/src/analytics/fertility.ts

export type FertilityPhase =
  | 'follicular'
  | 'ovulation'
  | 'luteal'
  | 'period'
  | 'uncertain';

export interface FertilityStatus {
  phase: FertilityPhase;
  confidence: number;
  reasoning: string;
}

/**
 * Patient-truth safety policy:
 * wearable physiology must not be converted into cycle-phase or ovulation
 * claims here. Only an explicit patient-entered period/ovulation event may
 * return a named phase. Otherwise the result remains uncertain.
 *
 * The numeric arrays are retained in the signature for compatibility with
 * existing callers, but are deliberately not interpreted.
 */
export function getFertilityStatus(
  _temps: number[],
  _hrv: number[],
  _rhr: number[],
  _baseline: number,
  manual?: { period?: boolean; ovulation?: boolean },
): FertilityStatus {
  if (manual?.period === true) {
    return {
      phase: 'period',
      confidence: 1,
      reasoning: 'Explicit patient-entered period log',
    };
  }

  if (manual?.ovulation === true) {
    return {
      phase: 'ovulation',
      confidence: 1,
      reasoning: 'Explicit patient-entered ovulation log',
    };
  }

  return {
    phase: 'uncertain',
    confidence: 0,
    reasoning: 'Wearable cycle-phase inference is disabled',
  };
}
