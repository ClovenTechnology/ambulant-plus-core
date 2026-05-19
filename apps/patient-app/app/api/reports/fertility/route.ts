import { NextRequest, NextResponse } from 'next/server';
import { getFertilityStatus } from '@/src/analytics/fertility';
import { detectPregnancy, computeAnomalies, summarizeCycleChanges } from '@/src/analytics/prediction';

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
};

type FertilityTrendPoint = {
  date: string;
  deltaTemp?: number;
  tempC?: number;
  hrv?: number;
  rhr?: number;
  spo2?: number;
  phase?: string;
  confidence?: number;
};

type FertilityReportResponse = {
  ok: boolean;
  patientId: string;
  range: RangeKey;
  generatedAtISO: string;
  mock?: boolean;
  summary: {
    currentPhase: string;
    confidence: number;
    baselineTempC: number | null;
    latestTempDelta: number | null;
    avgHrv: number | null;
    avgRhr: number | null;
    likelyPregnancy: boolean;
    pregnancyConfidence: number;
    sampleCounts: {
      temperature: number;
      hrv: number;
      rhr: number;
      spo2: number;
    };
  };
  latest: {
    date: string | null;
    deltaTemp?: number;
    tempC?: number;
    hrv?: number;
    rhr?: number;
    spo2?: number;
    phase?: string;
    confidence?: number;
  };
  trend: FertilityTrendPoint[];
  insights: {
    headline: string;
    bullets: string[];
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

function toDateISO(v: string | null): string | null {
  if (!v) return null;
  return v.slice(0, 10);
}

function buildMockFertilityReport(patientId: string, range: RangeKey, lmp?: string | null, cycleDays?: number | null): FertilityReportResponse {
  const days = rangeToDays(range);
  const now = new Date();
  const rnd = smoothRand(now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate());

  let tempBase = 36.5;
  let hrvBase = 56;
  let rhrBase = 59;
  let spo2Base = 98;

  const temps: number[] = [];
  const hrvArr: number[] = [];
  const rhrArr: number[] = [];
  const trend: FertilityTrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    const cycleLen = cycleDays && cycleDays >= 21 && cycleDays <= 35 ? cycleDays : 28;
    const cycleDay = ((days - i) % cycleLen) + 1;
    const aroundOvulation = cycleDay >= cycleLen - 15 && cycleDay <= cycleLen - 12;
    const luteal = cycleDay > cycleLen - 12;

    const tempC = clamp(
      tempBase +
        (luteal ? 0.25 : 0) +
        (aroundOvulation ? 0.05 : 0) +
        (rnd() * 0.12 - 0.06),
      36.1,
      37.2,
    );
    const hrv = clamp(
      hrvBase - (aroundOvulation ? 8 : 0) + (rnd() * 6 - 3),
      25,
      95,
    );
    const rhr = clamp(
      rhrBase + (luteal ? 4 : 0) + (rnd() * 4 - 2),
      45,
      85,
    );
    const spo2 = clamp(
      spo2Base + (rnd() * 2 - 1),
      94,
      100,
    );

    temps.push(tempC);
    hrvArr.push(hrv);
    rhrArr.push(rhr);

    trend.push({
      date: d.toISOString().slice(0, 10),
      tempC,
      hrv: Math.round(hrv),
      rhr: Math.round(rhr),
      spo2: Math.round(spo2),
    });
  }

  const baseline = avg(temps.slice(0, Math.min(14, temps.length))) ?? 36.5;
  const points = trend.map((p) => ({
    ...p,
    deltaTemp: typeof p.tempC === 'number' ? Number((p.tempC - baseline).toFixed(2)) : undefined,
  }));

  const phase = getFertilityStatus(
    points.map((p) => p.deltaTemp ?? 0),
    points.map((p) => p.hrv ?? 0),
    points.map((p) => p.rhr ?? 0),
    baseline,
  );

  const pregnancy = detectPregnancy(
    lmp && cycleDays ? { lmp, cycleDays } : null,
    points.map((p) => ({
      date: p.date,
      deltaTemp: p.deltaTemp,
      hrv: p.hrv,
      rhr: p.rhr,
      spo2: p.spo2,
    })),
    {},
    { highAccuracy: true },
  );

  const enriched = points.map((p) => ({
    ...p,
    phase: phase.phase,
    confidence: phase.confidence,
  }));

  const latest = enriched[enriched.length - 1] || null;
  const bullets = summarizeCycleChanges(
    enriched.map((p) => ({
      date: p.date,
      deltaTemp: p.deltaTemp,
      hrv: p.hrv,
      rhr: p.rhr,
      spo2: p.spo2,
    })),
  );

  return {
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: true,
    summary: {
      currentPhase: phase.phase,
      confidence: phase.confidence,
      baselineTempC: baseline,
      latestTempDelta: latest?.deltaTemp ?? null,
      avgHrv: avg(enriched.map((p) => p.hrv)),
      avgRhr: avg(enriched.map((p) => p.rhr)),
      likelyPregnancy: pregnancy.status === 'likely' || pregnancy.status === 'confirmed',
      pregnancyConfidence: pregnancy.confidence,
      sampleCounts: {
        temperature: enriched.length,
        hrv: enriched.length,
        rhr: enriched.length,
        spo2: enriched.length,
      },
    },
    latest: latest
      ? {
          date: latest.date,
          deltaTemp: latest.deltaTemp,
          tempC: latest.tempC,
          hrv: latest.hrv,
          rhr: latest.rhr,
          spo2: latest.spo2,
          phase: latest.phase,
          confidence: latest.confidence,
        }
      : {
          date: null,
        },
    trend: enriched,
    insights: {
      headline: 'Showing demo fertility data until persisted wearable-derived fertility inputs are fully wired.',
      bullets,
      recommendations: [
        {
          title: 'Build continuous wear history',
          detail: 'Fertility interpretation improves when temperature, HRV, and resting HR stay continuous across more cycle days.',
        },
        {
          title: 'Add cycle anchors',
          detail: 'LMP, period logs, and ovulation confirmations strengthen confidence dramatically.',
        },
      ],
    },
    sources: {
      temperature: { source: 'mock_fertility_generator', recorded_at: latest?.date ?? null, inferred: true },
      hrv: { source: 'mock_fertility_generator', recorded_at: latest?.date ?? null, inferred: true },
      rhr: { source: 'mock_fertility_generator', recorded_at: latest?.date ?? null, inferred: true },
      spo2: { source: 'mock_fertility_generator', recorded_at: latest?.date ?? null, inferred: true },
    },
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const patientId = url.searchParams.get('patientId') || 'patient-123';
  const range = parseRange(url.searchParams.get('range'));
  const lmp = url.searchParams.get('lmp');
  const cycleDays = (() => {
    const n = Number(url.searchParams.get('cycleDays'));
    return Number.isFinite(n) ? Math.round(n) : null;
  })();

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - (rangeToDays(range) - 1));

  const from = fromDate.toISOString();
  const to = now.toISOString();

  const [tempRows, hrvRows, rhrRows, hrRows, spo2Rows] = await Promise.all([
    fetchVitalsForType(url.origin, patientId, 'temperature', from, to),
    fetchVitalsForType(url.origin, patientId, 'hrv', from, to),
    fetchVitalsForType(url.origin, patientId, 'resting_heart_rate', from, to),
    fetchVitalsForType(url.origin, patientId, 'heart_rate', from, to),
    fetchVitalsForType(url.origin, patientId, 'spo2', from, to),
  ]);

  const byDate = new Map<string, FertilityTrendPoint>();

  const ensurePoint = (date: string | null) => {
    if (!date) return null;
    if (!byDate.has(date)) byDate.set(date, { date });
    return byDate.get(date)!;
  };

  for (const row of tempRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(row.payload?.celsius ?? row.payload?.temp_c ?? row.payload?.temperature ?? row.payload?.value);
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.tempC = value;
  }

  for (const row of hrvRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(row.payload?.hrv ?? row.payload?.avgHrv ?? row.payload?.value);
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.hrv = value;
  }

  for (const row of rhrRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(row.payload?.rhr ?? row.payload?.value ?? row.payload?.hr);
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.rhr = value;
  }

  for (const row of hrRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(row.payload?.bpm ?? row.payload?.hr ?? row.payload?.heartRate ?? row.payload?.value);
    const p = ensurePoint(date);
    if (p && typeof value === 'number' && typeof p.rhr !== 'number') {
      p.rhr = value;
    }
  }

  for (const row of spo2Rows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(row.payload?.pct ?? row.payload?.spo2 ?? row.payload?.SpO2 ?? row.payload?.value);
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.spo2 = value;
  }

  const trend = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const meaningful =
    trend.some((t) => typeof t.tempC === 'number') ||
    trend.some((t) => typeof t.hrv === 'number') ||
    trend.some((t) => typeof t.rhr === 'number');

  if (!meaningful) {
    return NextResponse.json(buildMockFertilityReport(patientId, range, lmp, cycleDays));
  }

  const tempSeries = trend.map((p) => p.tempC).filter((n): n is number => typeof n === 'number');
  const baselineTemp = avg(tempSeries.slice(0, Math.min(14, tempSeries.length))) ?? avg(tempSeries) ?? 36.5;

  const enriched = trend.map((p) => ({
    ...p,
    deltaTemp: typeof p.tempC === 'number' ? Number((p.tempC - baselineTemp).toFixed(2)) : undefined,
  }));

  const phase = getFertilityStatus(
    enriched.map((p) => p.deltaTemp ?? 0),
    enriched.map((p) => p.hrv ?? 0),
    enriched.map((p) => p.rhr ?? 0),
    baselineTemp,
  );

  const pregnancy = detectPregnancy(
    lmp && cycleDays ? { lmp, cycleDays } : null,
    enriched.map((p) => ({
      date: p.date,
      deltaTemp: p.deltaTemp,
      hrv: p.hrv,
      rhr: p.rhr,
      spo2: p.spo2,
    })),
    {},
    { highAccuracy: true },
  );

  const anomalies = computeAnomalies(
    enriched.map((p) => ({
      date: p.date,
      deltaTemp: p.deltaTemp,
      hrv: p.hrv,
      rhr: p.rhr,
      spo2: p.spo2,
    })),
  );

  const bullets = summarizeCycleChanges(
    enriched.map((p) => ({
      date: p.date,
      deltaTemp: p.deltaTemp,
      hrv: p.hrv,
      rhr: p.rhr,
      spo2: p.spo2,
    })),
  );

  const phaseEnriched = enriched.map((p) => ({
    ...p,
    phase: phase.phase,
    confidence: phase.confidence,
  }));

  const latest = phaseEnriched[phaseEnriched.length - 1] || null;
  const latestRecordedAt =
    latest?.date ? `${latest.date}T00:00:00.000Z` : null;

  const headline =
    pregnancy.status === 'confirmed'
      ? 'A positive pregnancy signal is present in the supplied context.'
      : pregnancy.status === 'likely'
        ? 'Wearable trends suggest a possible pregnancy signal, but confirmation requires clinical-grade validation.'
        : phase.phase === 'luteal'
          ? 'Current wearable trends are more consistent with a luteal-phase pattern.'
          : phase.phase === 'ovulation'
            ? 'Current wearable trends suggest a possible ovulation window.'
            : 'Wearable trends are currently more consistent with a follicular or non-specific pattern.';

  return NextResponse.json({
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    summary: {
      currentPhase: phase.phase,
      confidence: phase.confidence,
      baselineTempC: baselineTemp,
      latestTempDelta: latest?.deltaTemp ?? null,
      avgHrv: avg(phaseEnriched.map((p) => p.hrv)),
      avgRhr: avg(phaseEnriched.map((p) => p.rhr)),
      likelyPregnancy: pregnancy.status === 'likely' || pregnancy.status === 'confirmed',
      pregnancyConfidence: pregnancy.confidence,
      sampleCounts: {
        temperature: tempRows.length,
        hrv: hrvRows.length,
        rhr: rhrRows.length + hrRows.length,
        spo2: spo2Rows.length,
      },
    },
    latest: latest
      ? {
          date: latest.date,
          deltaTemp: latest.deltaTemp,
          tempC: latest.tempC,
          hrv: latest.hrv,
          rhr: latest.rhr,
          spo2: latest.spo2,
          phase: latest.phase,
          confidence: latest.confidence,
        }
      : {
          date: null,
        },
    trend: phaseEnriched,
    insights: {
      headline,
      bullets: [
        ...bullets,
        ...(anomalies.sustainedTempRise
          ? [`Sustained temperature rise started ${anomalies.sustainedTempRise.start}.`]
          : []),
      ].slice(0, 8),
      recommendations: [
        {
          title: 'Keep temperature continuity strong',
          detail: 'Nightly temperature continuity is one of the most important inputs for better fertility interpretation.',
        },
        {
          title: 'Add cycle anchors',
          detail: 'Supplying LMP, cycle length, and manual event logs will improve phase and pregnancy-confidence logic.',
        },
      ],
    },
    sources: {
      temperature: {
        source: tempRows.length ? 'patient_vitals_temp_read_model' : 'unavailable',
        recorded_at: latestRecordedAt,
        inferred: false,
      },
      hrv: {
        source: hrvRows.length ? 'patient_vitals_hrv_read_model' : 'unavailable',
        recorded_at: latestRecordedAt,
        inferred: false,
      },
      rhr: {
        source: rhrRows.length
          ? 'patient_vitals_rhr_read_model'
          : hrRows.length
            ? 'patient_vitals_hr_read_model'
            : 'unavailable',
        recorded_at: latestRecordedAt,
        inferred: !rhrRows.length && !!hrRows.length,
      },
      spo2: {
        source: spo2Rows.length ? 'patient_vitals_spo2_read_model' : 'unavailable',
        recorded_at: latestRecordedAt,
        inferred: false,
      },
    },
  } satisfies FertilityReportResponse);
}