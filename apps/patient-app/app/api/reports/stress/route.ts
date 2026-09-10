import { NextRequest, NextResponse } from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
  type PatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type VitalRow = {
  payload?: Record<string, any> | null;
  recorded_at?: string | null;
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
};

function parseRange(range: string | null): RangeKey {
  return range === '7d' || range === '90d' || range === '1y' ? range : '30d';
}

function rangeToDays(range: RangeKey): number {
  if (range === '7d') return 7;
  if (range === '90d') return 90;
  if (range === '1y') return 365;
  return 30;
}

function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function rowTs(row: VitalRow): string | null {
  return safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
}

function average(values: Array<number | undefined>): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

async function fetchVitalsForType(
  req: NextRequest,
  identity: PatientGatewayIdentity,
  type: string,
  from: string,
  to: string,
): Promise<VitalRow[]> {
  const qs = new URLSearchParams({ type, from, to });
  const url = `${req.nextUrl.origin}/api/v1/patients/${encodeURIComponent(identity.patientId)}/vitals?${qs.toString()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: patientGatewayHeaders({ req, identity }),
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({ items: [] }));
  return Array.isArray(json?.items) ? json.items : [];
}

export async function GET(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { ok: false, error: 'patient_authentication_required' },
      { status: 401 },
    );
  }

  const requestedPatientId = String(req.nextUrl.searchParams.get('patientId') || '').trim();
  if (requestedPatientId && requestedPatientId !== identity.patientId) {
    return NextResponse.json(
      { ok: false, error: 'patient_context_mismatch' },
      { status: 403 },
    );
  }

  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - (rangeToDays(range) - 1));
  const from = fromDate.toISOString();
  const to = now.toISOString();

  // Direct persisted observations only. No stress score is synthesized from
  // HRV, heart rate, sleep, steps, calories or distance.
  const [stressRows, hrvRows, restingHrRows] = await Promise.all([
    fetchVitalsForType(req, identity, 'stress', from, to),
    fetchVitalsForType(req, identity, 'hrv', from, to),
    fetchVitalsForType(req, identity, 'resting_heart_rate', from, to),
  ]);

  const points = new Map<string, StressTrendPoint>();

  function pointFor(ts: string | null) {
    if (!ts) return null;
    if (!points.has(ts)) points.set(ts, { ts });
    return points.get(ts)!;
  }

  for (const row of stressRows) {
    const ts = rowTs(row);
    const value = toNum(
      row.payload?.stressIndex ??
        row.payload?.index ??
        row.payload?.score ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    const point = pointFor(ts);
    if (point && typeof value === 'number') point.stressIndex = clamp(value, 0, 100);
  }

  for (const row of hrvRows) {
    const ts = rowTs(row);
    const value = toNum(
      row.payload?.ms ??
        row.payload?.hrv ??
        row.payload?.avgHrv ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    const point = pointFor(ts);
    if (point && typeof value === 'number') point.hrv = value;
  }

  for (const row of restingHrRows) {
    const ts = rowTs(row);
    const value = toNum(
      row.payload?.rhr ??
        row.payload?.restingHeartRate ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    const point = pointFor(ts);
    if (point && typeof value === 'number') point.restingHr = value;
  }

  const trend = Array.from(points.values())
    .filter(
      (point) =>
        typeof point.stressIndex === 'number' ||
        typeof point.hrv === 'number' ||
        typeof point.restingHr === 'number',
    )
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .slice(-365);

  const latest = trend[trend.length - 1] ?? null;
  const latestStress = [...trend].reverse().find((point) => typeof point.stressIndex === 'number');
  const latestHrv = [...trend].reverse().find((point) => typeof point.hrv === 'number');
  const latestRhr = [...trend].reverse().find((point) => typeof point.restingHr === 'number');

  return NextResponse.json({
    ok: true,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    inferenceMode: 'direct_observations_only',
    summary: {
      avgStressIndex: average(trend.map((point) => point.stressIndex)),
      avgHrv: average(trend.map((point) => point.hrv)),
      avgRestingHr: average(trend.map((point) => point.restingHr)),
      avgSleepScore: null,
      avgActivityLoad: null,
      sampleCounts: {
        directStress: stressRows.length,
        hrv: hrvRows.length,
        restingHr: restingHrRows.length,
        sleep: 0,
        activity: 0,
      },
    },
    latest: {
      ts: latest?.ts ?? null,
      stressIndex: latestStress?.stressIndex,
      hrv: latestHrv?.hrv,
      restingHr: latestRhr?.restingHr,
    },
    trend,
    insights: {
      headline: stressRows.length
        ? 'Direct persisted stress observations are available for this range.'
        : 'No direct persisted stress score is available for this range.',
      highlights: [
        {
          title: 'Direct measurements only',
          detail:
            'This report does not calculate a stress score from HRV, resting heart rate, sleep, activity, calories or distance.',
        },
      ],
      recommendations: [],
    },
    sources: {
      stressIndex: {
        source: stressRows.length ? 'patient_vitals_stress_read_model' : 'unavailable',
        recorded_at: latestStress?.ts ?? null,
        inferred: false,
      },
      hrv: {
        source: hrvRows.length ? 'patient_vitals_hrv_read_model' : 'unavailable',
        recorded_at: latestHrv?.ts ?? null,
        inferred: false,
      },
      restingHr: {
        source: restingHrRows.length ? 'patient_vitals_rhr_read_model' : 'unavailable',
        recorded_at: latestRhr?.ts ?? null,
        inferred: false,
      },
      sleepScore: { source: 'unavailable', recorded_at: null, inferred: false },
      activityLoad: { source: 'unavailable', recorded_at: null, inferred: false },
    },
  });
}
