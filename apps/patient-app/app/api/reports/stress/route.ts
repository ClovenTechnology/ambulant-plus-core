import { NextRequest, NextResponse } from 'next/server';
import { computeStressIndex, stressIndex } from '@/src/analytics/stress';
import { computeSleepQuality } from '@/src/analytics/sleep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type VitalRow = {
  id?: string;
  patientId?: string;
  type?: string;
  payload?: Record<string, any> | null;
  recorded_at?: string | null;
  meta?: Record<string, any> | null;
  createdAt?: string | null;
  ts?: string | null;
  value?: number | string | null;
  valueNum?: number | string | null;
};

type StressTrendPoint = {
  ts: string;
  stressIndex?: number;
  hrv?: number;
  restingHr?: number;
  sleepScore?: number;
  activityLoad?: number;
};

type StressReportResponse = {
  ok: boolean;
  patientId: string;
  range: RangeKey;
  generatedAtISO: string;
  mock?: boolean;
  summary: {
    avgStressIndex: number | null;
    avgHrv: number | null;
    avgRestingHr: number | null;
    avgSleepScore: number | null;
    avgActivityLoad: number | null;
    sampleCounts: {
      hrv: number;
      restingHr: number;
      sleep: number;
      activity: number;
      directStress: number;
    };
  };
  latest: {
    ts: string | null;
    stressIndex?: number;
    hrv?: number;
    restingHr?: number;
    sleepScore?: number;
    activityLoad?: number;
  };
  trend: StressTrendPoint[];
  insights: {
    headline: string;
    highlights: Array<{ title: string; detail: string }>;
    recommendations: Array<{ title: string; detail: string }>;
  };
  sources: Record<string, { source: string; recorded_at: string | null; inferred?: boolean }>;
};

function parseRange(range: string | null): RangeKey {
  if (range === '7d' || range === '30d' || range === '90d' || range === '1y') return range;
  return '30d';
}

function rangeToDays(range: RangeKey): number {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 365;
}

function toNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function safeIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function avg(values: Array<number | undefined>): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function smoothRand(seed: number) {
  let t = seed % 2147483647;
  return () => {
    t = (t * 48271) % 2147483647;
    return (t & 0xfffffff) / 0xfffffff;
  };
}

async function fetchVitalsForType(
  origin: string,
  patientId: string,
  type?: string,
  from?: string,
  to?: string,
): Promise<VitalRow[]> {
  const qs = new URLSearchParams();
  if (type) qs.set('type', type);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);

  const url = `${origin}/api/v1/patients/${encodeURIComponent(patientId)}/vitals${
    qs.toString() ? `?${qs.toString()}` : ''
  }`;

  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return [];

  const j = await r.json().catch(() => ({ items: [] }));
  return Array.isArray(j?.items) ? j.items : [];
}

function pickTs(row: VitalRow): string | null {
  return safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt) || null;
}

function computeActivityLoadFromPayload(payload: Record<string, any> | null | undefined): number | undefined {
  const load = toNum(payload?.activityLoad ?? payload?.load);
  if (typeof load === 'number') return clamp(load, 0, 100);

  const steps = toNum(payload?.steps) ?? 0;
  const calories = toNum(payload?.calories) ?? 0;
  const distance = toNum(payload?.distance) ?? 0;

  const score = steps / 120 + calories / 25 + distance * 5;
  return score > 0 ? clamp(score, 0, 100) : undefined;
}

function computeSleepScoreFromRow(row: VitalRow): number | undefined {
  const payload = row.payload || {};
  const stages = payload?.stagesMin || payload;

  const deep = toNum(stages?.deep) ?? 0;
  const rem = toNum(stages?.rem) ?? 0;
  const light = toNum(stages?.light) ?? 0;
  const awake = toNum(stages?.awake) ?? 0;

  const total = deep + rem + light + awake;
  if (total <= 0) return undefined;

  const hrv = toNum(payload?.hrv ?? payload?.avgHrv ?? payload?.readinessHrv) ?? 50;
  const efficiency =
    toNum(payload?.efficiency) ??
    (deep + rem + light) / Math.max(1, total);

  const q = computeSleepQuality({ deep, rem, light, awake }, hrv, efficiency);
  return clamp(Math.round(q.score), 0, 100);
}

function buildMockStressReport(patientId: string, range: RangeKey): StressReportResponse {
  const days = rangeToDays(range);
  const now = new Date();
  const rnd = smoothRand(now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate());

  const trend: StressTrendPoint[] = [];
  let hrvBase = 52;
  let rhrBase = 62;
  let sleepBase = 74;
  let activityBase = 42;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    hrvBase = clamp(hrvBase + (rnd() * 6 - 3), 28, 90);
    rhrBase = clamp(rhrBase + (rnd() * 4 - 2), 48, 88);
    sleepBase = clamp(sleepBase + (rnd() * 10 - 5), 40, 95);
    activityBase = clamp(activityBase + (rnd() * 18 - 9), 5, 95);

    const computed = computeStressIndex(
      Math.round(hrvBase),
      Math.round(clamp(100 - sleepBase + activityBase * 0.35, 5, 90)),
      0,
      { inputType: 'hrv' }
    );

    trend.push({
      ts: d.toISOString(),
      stressIndex: computed.index,
      hrv: Math.round(hrvBase),
      restingHr: Math.round(rhrBase),
      sleepScore: Math.round(sleepBase),
      activityLoad: Math.round(activityBase),
    });
  }

  const latest = trend[trend.length - 1] || {};

  const avgStress = stressIndex(
    trend.map((t) => t.stressIndex).filter((n): n is number => typeof n === 'number')
  );

  return {
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: true,
    summary: {
      avgStressIndex: avgStress,
      avgHrv: avg(trend.map((t) => t.hrv)),
      avgRestingHr: avg(trend.map((t) => t.restingHr)),
      avgSleepScore: avg(trend.map((t) => t.sleepScore)),
      avgActivityLoad: avg(trend.map((t) => t.activityLoad)),
      sampleCounts: {
        hrv: trend.length,
        restingHr: trend.length,
        sleep: trend.length,
        activity: trend.length,
        directStress: 0,
      },
    },
    latest: {
      ts: latest.ts ?? null,
      stressIndex: latest.stressIndex,
      hrv: latest.hrv,
      restingHr: latest.restingHr,
      sleepScore: latest.sleepScore,
      activityLoad: latest.activityLoad,
    },
    trend,
    insights: {
      headline: 'Showing mock stress data until persisted HRV, sleep, and activity summaries are fully available.',
      highlights: [
        {
          title: 'Stress is multi-signal',
          detail: 'This report blends recovery, sleep, and activity context instead of using a single isolated score.',
        },
      ],
      recommendations: [
        {
          title: 'Protect recovery first',
          detail: 'Sleep consistency and lower overnight strain usually improve the stress picture before daytime tweaks do.',
        },
      ],
    },
    sources: {
      stressIndex: { source: 'mock_stress_generator', recorded_at: latest.ts ?? null, inferred: true },
      hrv: { source: 'mock_stress_generator', recorded_at: latest.ts ?? null, inferred: true },
      restingHr: { source: 'mock_stress_generator', recorded_at: latest.ts ?? null, inferred: true },
      sleepScore: { source: 'mock_stress_generator', recorded_at: latest.ts ?? null, inferred: true },
      activityLoad: { source: 'mock_stress_generator', recorded_at: latest.ts ?? null, inferred: true },
    },
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const patientId = url.searchParams.get('patientId') || 'patient-123';
  const range = parseRange(url.searchParams.get('range'));

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - (rangeToDays(range) - 1));

  const from = fromDate.toISOString();
  const to = now.toISOString();

  const [directStressRows, hrvRows, restingHrRows, hrRows, sleepRows, sleepScoreRows, activityRows] = await Promise.all([
    fetchVitalsForType(url.origin, patientId, 'stress', from, to),
    fetchVitalsForType(url.origin, patientId, 'hrv', from, to),
    fetchVitalsForType(url.origin, patientId, 'resting_heart_rate', from, to),
    fetchVitalsForType(url.origin, patientId, 'heart_rate', from, to),
    fetchVitalsForType(url.origin, patientId, 'sleep', from, to),
    fetchVitalsForType(url.origin, patientId, 'sleep_score', from, to),
    fetchVitalsForType(url.origin, patientId, 'activity', from, to),
  ]);

  const trendMap = new Map<string, StressTrendPoint>();

  const ensurePoint = (ts: string | null) => {
    if (!ts) return null;
    if (!trendMap.has(ts)) trendMap.set(ts, { ts });
    return trendMap.get(ts)!;
  };

  for (const row of hrvRows) {
    const ts = pickTs(row);
    const value = toNum(row.payload?.ms ?? row.payload?.value ?? row.payload?.hrv ?? row.payload?.avgHrv ?? row.valueNum ?? row.value);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number') p.hrv = value;
  }

  for (const row of restingHrRows) {
    const ts = pickTs(row);
    const value = toNum(row.payload?.rhr ?? row.payload?.value ?? row.payload?.hr ?? row.valueNum ?? row.value);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number') p.restingHr = value;
  }

  for (const row of hrRows) {
    const ts = pickTs(row);
    const value = toNum(row.payload?.bpm ?? row.payload?.hr ?? row.payload?.heartRate ?? row.payload?.value ?? row.valueNum ?? row.value);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number' && typeof p.restingHr !== 'number') {
      p.restingHr = value;
    }
  }

  for (const row of sleepRows) {
    const ts = pickTs(row);
    const value = computeSleepScoreFromRow(row);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number') p.sleepScore = value;
  }

  for (const row of sleepScoreRows) {
    const ts = pickTs(row);
    const value = toNum(row.payload?.score ?? row.payload?.sleepScore ?? row.payload?.value ?? row.valueNum ?? row.value);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number') p.sleepScore = clamp(Math.round(value), 0, 100);
  }

  for (const row of activityRows) {
    const ts = pickTs(row);
    const value = computeActivityLoadFromPayload(row.payload);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number') p.activityLoad = value;
  }

  for (const row of directStressRows) {
    const ts = pickTs(row);
    const value = toNum(row.payload?.value ?? row.payload?.stressIndex ?? row.payload?.index);
    const p = ensurePoint(ts);
    if (p && typeof value === 'number') p.stressIndex = clamp(value, 0, 100);
  }

  const trend = Array.from(trendMap.values())
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .slice(-180)
    .map((point) => {
      if (typeof point.stressIndex === 'number') return point;

      if (typeof point.hrv === 'number') {
        const derivedDayStress = Math.round(
          clamp(
            (typeof point.activityLoad === 'number' ? point.activityLoad * 0.45 : 18) +
              (typeof point.sleepScore === 'number' ? 100 - point.sleepScore : 20),
            0,
            100,
          ),
        );

        const computed = computeStressIndex(point.hrv, derivedDayStress, 0, { inputType: 'hrv' });
        return { ...point, stressIndex: computed.index };
      }

      if (typeof point.restingHr === 'number') {
        const derivedDayStress = Math.round(
          clamp(
            (typeof point.activityLoad === 'number' ? point.activityLoad * 0.45 : 18) +
              (typeof point.sleepScore === 'number' ? 100 - point.sleepScore : 20),
            0,
            100,
          ),
        );

        const computed = computeStressIndex(point.restingHr, derivedDayStress, 0, { inputType: 'rhr' });
        return { ...point, stressIndex: computed.index };
      }

      return point;
    });

  const meaningful =
    trend.some((t) => typeof t.stressIndex === 'number') ||
    trend.some((t) => typeof t.hrv === 'number') ||
    trend.some((t) => typeof t.restingHr === 'number');

  if (!meaningful) {
    return NextResponse.json(buildMockStressReport(patientId, range));
  }

  const latest = trend[trend.length - 1] || null;

  const avgStressIndexValue = (() => {
    const vals = trend.map((t) => t.stressIndex).filter((n): n is number => typeof n === 'number');
    return vals.length ? stressIndex(vals) : null;
  })();

  const headline =
    typeof avgStressIndexValue === 'number' && avgStressIndexValue > 70
      ? 'Stress load is running high — recovery support should be a priority.'
      : typeof avgStressIndexValue === 'number' && avgStressIndexValue > 40
        ? 'Stress load is moderate — watch sleep and recovery consistency.'
        : 'Stress signals look fairly stable across the selected range.';

  const latestTs = latest?.ts ?? null;

  return NextResponse.json({
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    summary: {
      avgStressIndex: avgStressIndexValue,
      avgHrv: avg(trend.map((t) => t.hrv)),
      avgRestingHr: avg(trend.map((t) => t.restingHr)),
      avgSleepScore: avg(trend.map((t) => t.sleepScore)),
      avgActivityLoad: avg(trend.map((t) => t.activityLoad)),
      sampleCounts: {
        hrv: hrvRows.length,
        restingHr: restingHrRows.length + hrRows.length,
        sleep: sleepRows.length + sleepScoreRows.length,
        activity: activityRows.length,
        directStress: directStressRows.length,
      },
    },
    latest: {
      ts: latestTs,
      stressIndex: latest?.stressIndex,
      hrv: latest?.hrv,
      restingHr: latest?.restingHr,
      sleepScore: latest?.sleepScore,
      activityLoad: latest?.activityLoad,
    },
    trend,
    insights: {
      headline,
      highlights: [
        {
          title: 'Derived stress index',
          detail: 'When direct stress scores are absent, this report derives stress from HRV or resting HR plus sleep and activity context.',
        },
        {
          title: 'Recovery matters',
          detail: 'Lower sleep quality and higher activity load can raise the effective stress picture even when a single metric looks acceptable.',
        },
      ],
      recommendations: [
        {
          title: 'Improve sleep regularity',
          detail: 'Consistent recovery usually lowers the stress profile more reliably than short-term reactive changes.',
        },
        {
          title: 'Watch activity load spikes',
          detail: 'Large increases in activity without recovery often show up as higher stress scores and reduced HRV.',
        },
      ],
    },
    sources: {
      stressIndex: {
        source: directStressRows.length ? 'patient_vitals_stress_read_model' : 'derived_from_hrv_rhr_sleep_activity',
        recorded_at: latestTs,
        inferred: !directStressRows.length,
      },
      hrv: {
        source: hrvRows.length ? 'patient_vitals_hrv_read_model' : 'unavailable',
        recorded_at: latestTs,
        inferred: false,
      },
      restingHr: {
        source: restingHrRows.length
          ? 'patient_vitals_rhr_read_model'
          : hrRows.length
            ? 'patient_vitals_hr_read_model'
            : 'unavailable',
        recorded_at: latestTs,
        inferred: !restingHrRows.length && !!hrRows.length,
      },
      sleepScore: {
        source: sleepScoreRows.length
          ? 'patient_vitals_sleep_score_read_model'
          : sleepRows.length
            ? 'patient_vitals_sleep_read_model'
            : 'unavailable',
        recorded_at: latestTs,
        inferred: true,
      },
      activityLoad: {
        source: activityRows.length ? 'patient_vitals_activity_read_model' : 'unavailable',
        recorded_at: latestTs,
        inferred: true,
      },
    },
  } satisfies StressReportResponse);
}