// apps/patient-app/src/analytics/prediction.ts
// Minimal helpers: predictCycleDates + high-accuracy weighting + pregnancy detection.
// Extended: computeAnomalies + summarizeCycleChanges (improved clinical heuristics).
// ============================================================================

export type FertilityPrefs = { lmp: string; cycleDays: number };
export type PredictOpts = { useLogs?: boolean; highAccuracy?: boolean };

// --- Tunable thresholds (adjust for your cohort) ---
const SPO2_THRESHOLD = 95;        // SpO2 below considered low
const HRV_DIP_SD_FACTOR = 1.2;    // hrV below (rolling mean - factor * sd) counts as dip
const HRV_ABSOLUTE_LOW = 40;      // absolute HRV considered low
const TEMP_SUSTAINED_RISE = 0.25; // °C sustained rise threshold post-ovulation
const TEMP_SUSTAINED_COUNT = 3;   // number of days to consider sustained

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function predictCycleDates(
  prefs: FertilityPrefs | null | undefined,
  todayISO: string,
  opts?: PredictOpts
) {
  if (!prefs?.lmp || !prefs?.cycleDays) return null;
  const cycle = Math.max(21, Math.min(35, Math.round(prefs.cycleDays)));
  const lmp = prefs.lmp;

  // naive prediction
  const cycleStart = lmp;
  const nextPeriodStart = addDaysISO(cycleStart, Math.round(cycle));
  const fertileStart = addDaysISO(cycleStart, Math.round(cycle - 18));
  const ovulation = addDaysISO(cycleStart, Math.round(cycle - 14));
  const fertileEnd = addDaysISO(cycleStart, Math.round(cycle - 12));

  // cycle day
  const diff =
    Math.floor((new Date(todayISO).getTime() - new Date(lmp).getTime()) / 86400000) % cycle;
  const cycleDay = (diff + cycle) % cycle || cycle;

  return {
    cycleLength: cycle,
    cycleDay,
    nextPeriodStart,
    fertileStart,
    fertileEnd,
    ovulation,
  };
}

export type WearablePoint = { date: string; deltaTemp?: number; hrv?: number; rhr?: number; spo2?: number };
export type PregnancySignal =
  | { status: 'none'; confidence: number; reasons: string[] }
  | { status: 'likely'; confidence: number; reasons: string[] }
  | { status: 'confirmed'; confidence: number; reasons: string[] };

export function detectPregnancy(
  prefs: FertilityPrefs | null | undefined,
  series: WearablePoint[],
  logs: Record<string, any> = {},
  opts?: PredictOpts
): PregnancySignal {
  const reasons: string[] = [];
  const high = !!opts?.highAccuracy;

  const todayISO = new Date().toISOString().slice(0, 10);
  const pred = predictCycleDates(prefs ?? null, todayISO, opts || {});
  if (!pred) return { status: 'none', confidence: 0.2, reasons: ['no-prefs'] };

  // Positive test wins
  const posTest = Object.values(logs || {}).some((v: any) => v?.pregTest === 'positive');
  if (posTest) {
    reasons.push('positive-test');
    return { status: 'confirmed', confidence: 0.98, reasons };
  }

  // sustained temp rise after ovulation (improved: check consecutive days)
  const afterOv = series.filter(s => s.date >= pred.ovulation);
  const rises = afterOv
    .map(s => (typeof s.deltaTemp === 'number' ? s.deltaTemp : NaN))
    .filter(Number.isFinite);
  const sustained = rises.length >= TEMP_SUSTAINED_COUNT && rises.slice(0, TEMP_SUSTAINED_COUNT).every(v => v >= TEMP_SUSTAINED_RISE);
  if (sustained) reasons.push('sustained-temp-rise');

  // missed period
  const near = [0, 1, 2, 3].some(off => (logs || {})[addDaysISO(pred.nextPeriodStart, off)]?.period);
  const missed = !near && new Date(todayISO) >= new Date(addDaysISO(pred.nextPeriodStart, 3));
  if (missed) reasons.push('missed-period');

  if (reasons.length === 0) return { status: 'none', confidence: 0.25, reasons: [] };

  // weigh factors
  const weightTemp = reasons.includes('sustained-temp-rise') ? (high ? 0.5 : 0.35) : 0;
  const weightMissed = reasons.includes('missed-period') ? 0.35 : 0;
  const base = 0.1;
  const conf = Math.min(0.98, weightTemp + weightMissed + base);
  return { status: 'likely', confidence: conf, reasons };
}

/**
 * computeAnomalies(series)
 * - returns structured anomalies:
 *   { hrvDips: string[] (dates), spo2Lows: string[] (dates), sustainedTempRise?: { start: string, length: number } }
 *
 * Uses rolling stats for HRV dips and absolute thresholds for SpO2. Will not throw on empty input.
 */
export function computeAnomalies(series: WearablePoint[] = []) {
  try {
    if (!Array.isArray(series) || series.length === 0) {
      return { hrvDips: [], spo2Lows: [], sustainedTempRise: null as null | { start: string; length: number } };
    }

    const s = [...series].sort((a, b) => a.date.localeCompare(b.date));
    const hrvValues: number[] = s.map(p => (typeof p.hrv === 'number' ? p.hrv : NaN));
    const spo2Dates: string[] = [];
    const hrvDips: string[] = [];

    // compute rolling mean & sd for HRV with a simple window
    function rollingStats(arr: number[], idx: number, window = 7) {
      const start = Math.max(0, idx - window);
      const slice = arr.slice(start, idx).filter(Number.isFinite);
      if (!slice.length) return { mean: NaN, sd: NaN };
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const sd = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length);
      return { mean, sd };
    }

    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      const spo2 = typeof p.spo2 === 'number' ? p.spo2 : NaN;
      if (Number.isFinite(spo2) && spo2 < SPO2_THRESHOLD) spo2Dates.push(p.date);

      const hrv = typeof p.hrv === 'number' ? p.hrv : NaN;
      if (Number.isFinite(hrv)) {
        const { mean, sd } = rollingStats(hrvValues, i, 7);
        if (Number.isFinite(mean) && Number.isFinite(sd)) {
          if (hrv < mean - HRV_DIP_SD_FACTOR * sd || hrv < HRV_ABSOLUTE_LOW) {
            hrvDips.push(p.date);
          }
        } else if (hrv < HRV_ABSOLUTE_LOW) {
          hrvDips.push(p.date);
        }
      }
    }

    // sustained temp rise detection (post-ovulation style): find the first run of consecutive days with deltaTemp >= threshold
    let sustainedTempStart: string | null = null;
    let sustainedCount = 0;
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      const dt = typeof p.deltaTemp === 'number' ? p.deltaTemp : NaN;
      if (Number.isFinite(dt) && dt >= TEMP_SUSTAINED_RISE) {
        sustainedCount++;
        if (!sustainedTempStart) sustainedTempStart = p.date;
        if (sustainedCount >= TEMP_SUSTAINED_COUNT) break;
      } else {
        sustainedTempStart = null;
        sustainedCount = 0;
      }
    }
    const sustainedTempRise = sustainedCount >= TEMP_SUSTAINED_COUNT && sustainedTempStart ? { start: sustainedTempStart, length: sustainedCount } : null;

    // dedupe and sort results
    const uniq = (arr: string[]) => Array.from(new Set(arr)).sort();

    return { hrvDips: uniq(hrvDips), spo2Lows: uniq(spo2Dates), sustainedTempRise };
  } catch {
    return { hrvDips: [], spo2Lows: [], sustainedTempRise: null };
  }
}

/**
 * summarizeCycleChanges(series)
 * - produces short, clinically-phrased bullets describing:
 *   - temp change, RHR trend, HRV trend, anomalies summary.
 */
export function summarizeCycleChanges(series: WearablePoint[] = []) {
  try {
    if (!Array.isArray(series) || series.length === 0) return [];

    const s = [...series].sort((a, b) => a.date.localeCompare(b.date));
    const n = s.length;
    const mid = Math.max(1, Math.floor(n / 2));
    const first = s.slice(0, mid);
    const last = s.slice(mid);

    const avg = (arr: number[]) => {
      const v = arr.filter(Number.isFinite);
      if (!v.length) return NaN;
      return v.reduce((a, b) => a + b, 0) / v.length;
    };

    const tFirst = first.map(p => (typeof p.deltaTemp === 'number' ? p.deltaTemp : NaN)).filter(Number.isFinite);
    const tLast = last.map(p => (typeof p.deltaTemp === 'number' ? p.deltaTemp : NaN)).filter(Number.isFinite);
    const rhrFirst = first.map(p => (typeof p.rhr === 'number' ? p.rhr : NaN)).filter(Number.isFinite);
    const rhrLast = last.map(p => (typeof p.rhr === 'number' ? p.rhr : NaN)).filter(Number.isFinite);
    const hrvFirst = first.map(p => (typeof p.hrv === 'number' ? p.hrv : NaN)).filter(Number.isFinite);
    const hrvLast = last.map(p => (typeof p.hrv === 'number' ? p.hrv : NaN)).filter(Number.isFinite);

    const avgTempFirst = avg(tFirst);
    const avgTempLast = avg(tLast);
    const avgRhrFirst = avg(rhrFirst);
    const avgRhrLast = avg(rhrLast);
    const avgHrvFirst = avg(hrvFirst);
    const avgHrvLast = avg(hrvLast);

    const bullets: string[] = [];

    // Temperature
    if (!Number.isNaN(avgTempFirst) && !Number.isNaN(avgTempLast)) {
      const delta = avgTempLast - avgTempFirst;
      if (Math.abs(delta) >= 0.2) {
        bullets.push(delta > 0 ? `Avg temperature rose by ~${delta.toFixed(2)}°C — consistent with luteal-phase rise.` : `Avg temperature dropped by ~${Math.abs(delta).toFixed(2)}°C vs earlier cycle.`);
      } else {
        bullets.push('No notable average temperature change this cycle.');
      }
    } else {
      bullets.push('Insufficient temperature data for cycle comparisons.');
    }

    // Resting heart rate
    if (!Number.isNaN(avgRhrFirst) && !Number.isNaN(avgRhrLast)) {
      const rhrDelta = avgRhrLast - avgRhrFirst;
      if (Math.abs(rhrDelta) >= 3) {
        bullets.push(rhrDelta > 0 ? `Resting HR increased ~${rhrDelta.toFixed(1)} bpm` : `Resting HR decreased ~${Math.abs(rhrDelta).toFixed(1)} bpm`);
      } else {
        bullets.push('Resting HR stable (±3 bpm).');
      }
    } else {
      bullets.push('Insufficient resting HR data for trend analysis.');
    }

    // HRV
    if (!Number.isNaN(avgHrvFirst) && !Number.isNaN(avgHrvLast)) {
      const hrvDelta = avgHrvLast - avgHrvFirst;
      if (Math.abs(hrvDelta) >= 8) {
        bullets.push(hrvDelta < 0 ? `HRV decreased by ~${Math.abs(hrvDelta).toFixed(0)} ms — may reflect stress or cycle variation.` : `HRV increased by ~${hrvDelta.toFixed(0)} ms.`);
      } else {
        bullets.push('HRV within expected variation this cycle.');
      }
    } else {
      bullets.push('Insufficient HRV data for trend analysis.');
    }

    // anomalies
    const anomalies = computeAnomalies(s);
    if (anomalies.sustainedTempRise) bullets.push(`Sustained temp rise starting ${anomalies.sustainedTempRise.start} for ${anomalies.sustainedTempRise.length} days.`);
    if (anomalies.hrvDips.length) bullets.push(`HRV dips on ${anomalies.hrvDips.join(', ')}.`);
    if (anomalies.spo2Lows.length) bullets.push(`Intermittent low SpO₂ on ${anomalies.spo2Lows.join(', ')} (threshold < ${SPO2_THRESHOLD}%).`);

    return bullets.slice(0, 8);
  } catch {
    return ['Summary unavailable due to data inconsistency.'];
  }
}
