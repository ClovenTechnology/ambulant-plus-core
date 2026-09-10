import { NextRequest, NextResponse } from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
  type PatientGatewayIdentity,
} from '@/src/lib/gateway-identity';
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
      temperatureDeviation: number;
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


async function fetchVitalsForType(
  req: NextRequest,
  identity: PatientGatewayIdentity,
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

  const r = await fetch(url, {
    cache: 'no-store',
    headers: patientGatewayHeaders({ req, identity }),
  });
  if (!r.ok) return [];

  const j = await r.json().catch(() => ({ items: [] }));
  return Array.isArray(j?.items) ? j.items : [];
}

function toDateISO(v: string | null): string | null {
  if (!v) return null;
  return v.slice(0, 10);
}

function buildUnavailableFertilityReport(patientId: string, range: RangeKey): FertilityReportResponse {
  return {
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    summary: {
      currentPhase: 'insufficient_data' as any,
      confidence: 0,
      baselineTempC: null,
      latestTempDelta: null,
      avgHrv: null,
      avgRhr: null,
      likelyPregnancy: false,
      pregnancyConfidence: 0,
      sampleCounts: {
        temperature: 0,
        temperatureDeviation: 0,
        hrv: 0,
        rhr: 0,
        spo2: 0,
      },
    },
    latest: {
      date: null,
    },
    trend: [],
    insights: {
      headline: 'Not enough persisted wearable data is available yet for fertility interpretation.',
      bullets: [
        'No synthetic fertility physiology is shown in production.',
        'Regular wearable readings and cycle anchors are needed before interpretation is available.',
      ],
      recommendations: [
        {
          title: 'Continue regular wearable checks',
          detail: 'Fertility interpretation improves when temperature variation, HRV, and resting heart-rate data are captured consistently.',
        },
        {
          title: 'Add cycle anchors',
          detail: 'LMP, cycle length, period logs, and ovulation confirmations improve confidence when persisted readings are available.',
        },
      ],
    },
    sources: {
      temperature: { source: 'unavailable', recorded_at: null, inferred: false },
      temperature_deviation: { source: 'unavailable', recorded_at: null, inferred: false },
      hrv: { source: 'unavailable', recorded_at: null, inferred: false },
      rhr: { source: 'unavailable', recorded_at: null, inferred: false },
      spo2: { source: 'unavailable', recorded_at: null, inferred: false },
    },
  } as FertilityReportResponse;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('range'));
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) {
    return NextResponse.json({ ok: false, error: 'patient_authentication_required' }, { status: 401 });
  }
  const requestedPatientId = String(url.searchParams.get('patientId') || '').trim();
  if (requestedPatientId && requestedPatientId !== identity.patientId) {
    return NextResponse.json({ ok: false, error: 'patient_context_mismatch' }, { status: 403 });
  }
  const patientId = identity.patientId;
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

  const [tempRows, tempDeviationRows, hrvRows, rhrRows, hrRows, spo2Rows] = await Promise.all([
    fetchVitalsForType(req, identity, url.origin, patientId, 'temperature', from, to),
    fetchVitalsForType(req, identity, url.origin, patientId, 'temperature_deviation', from, to),
    fetchVitalsForType(req, identity, url.origin, patientId, 'hrv', from, to),
    fetchVitalsForType(req, identity, url.origin, patientId, 'resting_heart_rate', from, to),
    fetchVitalsForType(req, identity, url.origin, patientId, 'heart_rate', from, to),
    fetchVitalsForType(req, identity, url.origin, patientId, 'spo2', from, to),
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
    const value = toNum(
      row.payload?.celsius ??
        row.payload?.temp_c ??
        row.payload?.temperature ??
        row.payload?.value ??
        (row as any).valueNum ??
        (row as any).value,
    );
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.tempC = value;
  }

  for (const row of tempDeviationRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(
      row.payload?.delta_c ??
        row.payload?.deltaC ??
        row.payload?.tempDeviation ??
        row.payload?.temperatureDeviation ??
        row.payload?.value ??
        (row as any).valueNum ??
        (row as any).value,
    );
    const p = ensurePoint(date);
    if (p && typeof value === 'number') {
      p.deltaTemp = Number(value.toFixed(2));
    }
  }

  for (const row of hrvRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(
      row.payload?.ms ??
        row.payload?.hrv ??
        row.payload?.avgHrv ??
        row.payload?.value ??
        (row as any).valueNum ??
        (row as any).value,
    );
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.hrv = value;
  }

  for (const row of rhrRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(
      row.payload?.rhr ??
        row.payload?.value ??
        row.payload?.hr ??
        (row as any).valueNum ??
        (row as any).value,
    );
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.rhr = value;
  }

  for (const row of hrRows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(
      row.payload?.bpm ??
        row.payload?.hr ??
        row.payload?.heartRate ??
        row.payload?.value ??
        (row as any).valueNum ??
        (row as any).value,
    );
    const p = ensurePoint(date);
    if (p && typeof value === 'number' && typeof p.rhr !== 'number') {
      p.rhr = value;
    }
  }

  for (const row of spo2Rows) {
    const ts = safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
    const date = toDateISO(ts);
    const value = toNum(
      row.payload?.pct ??
        row.payload?.spo2 ??
        row.payload?.SpO2 ??
        row.payload?.value ??
        (row as any).valueNum ??
        (row as any).value,
    );
    const p = ensurePoint(date);
    if (p && typeof value === 'number') p.spo2 = value;
  }

  const trend = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const meaningful =
    trend.some((t) => typeof t.tempC === 'number') ||
    trend.some((t) => typeof t.deltaTemp === 'number') ||
    trend.some((t) => typeof t.hrv === 'number') ||
    trend.some((t) => typeof t.rhr === 'number');

  if (!meaningful) {
    return NextResponse.json(buildUnavailableFertilityReport(patientId, range));
  }

  const tempSeries = trend.map((p) => p.tempC).filter((n): n is number => typeof n === 'number');
  const baselineTemp =
    tempSeries.length > 0
      ? avg(tempSeries.slice(0, Math.min(14, tempSeries.length))) ?? avg(tempSeries)
      : null;

  const enriched = trend.map((p) => ({
    ...p,
    deltaTemp:
      typeof p.deltaTemp === 'number'
        ? Number(p.deltaTemp.toFixed(2))
        : typeof p.tempC === 'number' && baselineTemp != null
          ? Number((p.tempC - baselineTemp).toFixed(2))
          : undefined,
  }));

  const phase = getFertilityStatus(
    enriched.map((p) => p.deltaTemp ?? 0),
    enriched.map((p) => p.hrv ?? 0),
    enriched.map((p) => p.rhr ?? 0),
    baselineTemp ?? 0,
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
        temperature: tempRows.length + tempDeviationRows.length,
        temperatureDeviation: tempDeviationRows.length,
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
        source: tempRows.length
          ? 'patient_vitals_temp_read_model'
          : tempDeviationRows.length
            ? 'patient_vitals_temperature_deviation_read_model'
            : 'unavailable',
        recorded_at: latestRecordedAt,
        inferred: false,
      },
      temperature_deviation: {
        source: tempDeviationRows.length
          ? 'patient_vitals_temperature_deviation_read_model'
          : 'unavailable',
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