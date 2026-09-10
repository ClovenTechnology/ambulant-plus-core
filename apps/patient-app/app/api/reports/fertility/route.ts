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

type ObservationPoint = {
  date: string;
  deltaTemp?: number;
  tempC?: number;
  hrv?: number;
  rhr?: number;
  spo2?: number;
};

function parseRange(value: string | null): RangeKey {
  return value === '7d' || value === '90d' || value === '1y' ? value : '30d';
}

function rangeToDays(range: RangeKey) {
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

function safeIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function rowTs(row: VitalRow) {
  return safeIso(row.recorded_at) || safeIso(row.ts) || safeIso(row.createdAt);
}

function rowDate(row: VitalRow) {
  return rowTs(row)?.slice(0, 10) ?? null;
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

  // Observational physiology only. Generic heart rate is deliberately not
  // substituted for resting heart rate.
  const [tempRows, tempDeviationRows, hrvRows, rhrRows, spo2Rows] = await Promise.all([
    fetchVitalsForType(req, identity, 'temperature', from, to),
    fetchVitalsForType(req, identity, 'temperature_deviation', from, to),
    fetchVitalsForType(req, identity, 'hrv', from, to),
    fetchVitalsForType(req, identity, 'resting_heart_rate', from, to),
    fetchVitalsForType(req, identity, 'spo2', from, to),
  ]);

  const byDate = new Map<string, ObservationPoint>();

  function pointFor(date: string | null) {
    if (!date) return null;
    if (!byDate.has(date)) byDate.set(date, { date });
    return byDate.get(date)!;
  }

  for (const row of tempRows) {
    const p = pointFor(rowDate(row));
    const value = toNum(
      row.payload?.celsius ??
        row.payload?.temp_c ??
        row.payload?.temperature ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    if (p && typeof value === 'number') p.tempC = value;
  }

  for (const row of tempDeviationRows) {
    const p = pointFor(rowDate(row));
    const value = toNum(
      row.payload?.deltaTemp ??
        row.payload?.delta_temp ??
        row.payload?.temperatureDeviation ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    if (p && typeof value === 'number') p.deltaTemp = value;
  }

  for (const row of hrvRows) {
    const p = pointFor(rowDate(row));
    const value = toNum(
      row.payload?.ms ??
        row.payload?.hrv ??
        row.payload?.avgHrv ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    if (p && typeof value === 'number') p.hrv = value;
  }

  for (const row of rhrRows) {
    const p = pointFor(rowDate(row));
    const value = toNum(
      row.payload?.rhr ??
        row.payload?.restingHeartRate ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    if (p && typeof value === 'number') p.rhr = value;
  }

  for (const row of spo2Rows) {
    const p = pointFor(rowDate(row));
    const value = toNum(
      row.payload?.spo2 ??
        row.payload?.percent ??
        row.payload?.value ??
        row.valueNum ??
        row.value,
    );
    if (p && typeof value === 'number') p.spo2 = value;
  }

  const trend = Array.from(byDate.values())
    .filter(
      (point) =>
        typeof point.tempC === 'number' ||
        typeof point.deltaTemp === 'number' ||
        typeof point.hrv === 'number' ||
        typeof point.rhr === 'number' ||
        typeof point.spo2 === 'number',
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = trend[trend.length - 1] ?? null;

  return NextResponse.json({
    ok: true,
    range,
    generatedAtISO: new Date().toISOString(),
    mock: false,
    inferenceMode: 'observational_only',
    summary: {
      currentPhase: null,
      confidence: null,
      baselineTempC: null,
      latestTempDelta: latest?.deltaTemp ?? null,
      avgHrv: average(trend.map((point) => point.hrv)),
      avgRhr: average(trend.map((point) => point.rhr)),
      likelyPregnancy: null,
      pregnancyConfidence: null,
      sampleCounts: {
        temperature: tempRows.length,
        temperatureDeviation: tempDeviationRows.length,
        hrv: hrvRows.length,
        rhr: rhrRows.length,
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
        }
      : { date: null },
    trend,
    insights: {
      headline: trend.length
        ? 'Persisted reproductive-health observations are available for this range.'
        : 'No persisted reproductive-health observations are available for this range.',
      bullets: [
        'This view does not infer cycle phase, ovulation or pregnancy from wearable physiology.',
      ],
      recommendations: [],
    },
    sources: {
      temperature: {
        source: tempRows.length ? 'patient_vitals_temperature_read_model' : 'unavailable',
        recorded_at: tempRows.length ? rowTs(tempRows[tempRows.length - 1]) : null,
        inferred: false,
      },
      temperature_deviation: {
        source: tempDeviationRows.length ? 'patient_vitals_temperature_deviation_read_model' : 'unavailable',
        recorded_at: tempDeviationRows.length ? rowTs(tempDeviationRows[tempDeviationRows.length - 1]) : null,
        inferred: false,
      },
      hrv: {
        source: hrvRows.length ? 'patient_vitals_hrv_read_model' : 'unavailable',
        recorded_at: hrvRows.length ? rowTs(hrvRows[hrvRows.length - 1]) : null,
        inferred: false,
      },
      rhr: {
        source: rhrRows.length ? 'patient_vitals_rhr_read_model' : 'unavailable',
        recorded_at: rhrRows.length ? rowTs(rhrRows[rhrRows.length - 1]) : null,
        inferred: false,
      },
      spo2: {
        source: spo2Rows.length ? 'patient_vitals_spo2_read_model' : 'unavailable',
        recorded_at: spo2Rows.length ? rowTs(spo2Rows[spo2Rows.length - 1]) : null,
        inferred: false,
      },
    },
  });
}
