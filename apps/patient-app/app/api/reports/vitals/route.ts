// apps/patient-app/app/api/reports/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type VitalRow = {
  id?: string;
  type?: string;
  vType?: string;
  value?: number | string | null;
  valueNum?: number | string | null;
  unit?: string | null;
  recorded_at?: string | null;
  t?: string | null;
  ts?: string | null;
  createdAt?: string | null;
  deviceId?: string | null;
  source?: string | null;
  roomId?: string | null;
  payload?: Record<string, any> | null;
  meta?: Record<string, any> | null;
};

type VitalsTrendPoint = {
  ts: string;
  hr?: number;
  spo2?: number;
  temp_c?: number;
  glucose?: number;
  sys?: number;
  dia?: number;
};

type SourceRecord = {
  source: string;
  recorded_at: string | null;
  vType?: string;
  deviceId?: string | null;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function parseRange(value: string | null): RangeKey {
  if (value === '7d' || value === '30d' || value === '90d' || value === '1y') return value;
  return '30d';
}

function rangeDays(range: RangeKey) {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 365;
}

function toNum(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function pickTs(row: VitalRow) {
  const raw = row.recorded_at || row.t || row.ts || row.createdAt || '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function metricKey(row: VitalRow) {
  return String(row.vType || row.type || '').trim();
}

function metricValue(row: VitalRow, ...payloadKeys: string[]) {
  const payload = row.payload || {};

  const direct = toNum(row.valueNum, row.value);
  if (direct !== undefined) return direct;

  for (const key of payloadKeys) {
    const value = toNum(payload[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function parseBp(payload: Record<string, any> | null | undefined) {
  const systolic = toNum(payload?.systolic, payload?.sys, payload?.sbp, payload?.high);
  const diastolic = toNum(payload?.diastolic, payload?.dia, payload?.dbp, payload?.low);
  const text =
    typeof payload?.bp === 'string'
      ? payload.bp
      : typeof payload?.value === 'string'
        ? payload.value
        : '';

  if ((systolic == null || diastolic == null) && text.includes('/')) {
    const [s, d] = text.split('/');
    return { sys: toNum(s), dia: toNum(d) };
  }

  return { sys: systolic, dia: diastolic };
}

function average(values: Array<number | undefined>) {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sourceFor(row: VitalRow, ts: string | null): SourceRecord {
  return {
    source: row.source || row.deviceId || 'patient-vitals',
    recorded_at: ts,
    vType: metricKey(row) || undefined,
    deviceId: row.deviceId || null,
  };
}

function mergePoint(
  map: Map<string, VitalsTrendPoint>,
  ts: string,
  patch: Partial<VitalsTrendPoint>,
) {
  const existing = map.get(ts) || { ts };
  map.set(ts, { ...existing, ...patch });
}

function latestMetric(rows: VitalRow[], keys: string[], pick: (row: VitalRow) => number | undefined) {
  const found = rows
    .map((row) => {
      const ts = pickTs(row);
      if (!ts) return null;
      const key = metricKey(row);
      if (!keys.includes(key)) return null;
      const value = pick(row);
      if (value === undefined) return null;
      return { row, ts, value };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Date.parse(b.ts) - Date.parse(a.ts))[0] as
    | { row: VitalRow; ts: string; value: number }
    | undefined;

  return found || null;
}

async function resolvePatientId(req: NextRequest) {
  const url = new URL(req.url);
  const queryPatientId = String(url.searchParams.get('patientId') || '').trim();
  if (queryPatientId) return queryPatientId;

  const profileRes = await fetch(`${url.origin}/api/profile`, {
    cache: 'no-store',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  }).catch(() => null);

  if (!profileRes?.ok) return '';

  const profile = await profileRes.json().catch(() => null);
  return String(profile?.patientId || profile?.id || '').trim();
}

async function loadVitals(req: NextRequest, patientId: string, range: RangeKey) {
  const to = new Date();
  const from = new Date(to.getTime() - rangeDays(range) * 24 * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    limit: '500',
  });

  const url = new URL(req.url);
  const res = await fetch(
    `${url.origin}/api/v1/patients/${encodeURIComponent(patientId)}/vitals?${qs.toString()}`,
    {
      cache: 'no-store',
      headers: {
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || '',
      },
    },
  ).catch(() => null);

  if (!res?.ok) return [];

  const data = await res.json().catch(() => null);
  return Array.isArray(data?.items) ? (data.items as VitalRow[]) : [];
}

function normalizeTrend(rows: VitalRow[]) {
  const map = new Map<string, VitalsTrendPoint>();

  for (const row of rows) {
    const ts = pickTs(row);
    if (!ts) continue;

    const key = metricKey(row);
    const payload = row.payload || {};

    if (key === 'heart_rate') {
      const hr = metricValue(row, 'bpm', 'value', 'hr', 'pulse');
      if (hr !== undefined) mergePoint(map, ts, { hr });
      continue;
    }

    if (key === 'spo2') {
      const spo2 = metricValue(row, 'pct', 'value', 'spo2');
      const pulse = toNum(payload.pulse, payload.hr);

      if (spo2 !== undefined) mergePoint(map, ts, { spo2 });
      if (pulse !== undefined) mergePoint(map, ts, { hr: pulse });
      continue;
    }

    if (key === 'spo2_pulse') {
      const hr = metricValue(row, 'pulse', 'hr', 'value');
      if (hr !== undefined) mergePoint(map, ts, { hr });
      continue;
    }

    if (key === 'temperature' || key === 'temperature_celsius') {
      const temp_c = metricValue(row, 'celsius', 'value', 'temp', 'temperature');
      if (temp_c !== undefined) mergePoint(map, ts, { temp_c });
      continue;
    }

    if (key === 'temperature_fahrenheit') {
      const f = metricValue(row, 'fahrenheit', 'value');
      if (f !== undefined) mergePoint(map, ts, { temp_c: (f - 32) * (5 / 9) });
      continue;
    }

    if (key === 'blood_glucose' || key === 'glucose') {
      const glucose = metricValue(row, 'mgDl', 'mg_dl', 'value', 'glucose');
      if (glucose !== undefined) mergePoint(map, ts, { glucose });
      continue;
    }

    if (key === 'blood_pressure') {
      const bp = parseBp(payload);
      const pulse = toNum(payload.pulse, payload.hr);

      mergePoint(map, ts, {
        sys: bp.sys,
        dia: bp.dia,
        ...(pulse !== undefined ? { hr: pulse } : {}),
      });
      continue;
    }

    if (key === 'blood_pressure_systolic') {
      const sys = metricValue(row, 'systolic', 'sys', 'value');
      if (sys !== undefined) mergePoint(map, ts, { sys });
      continue;
    }

    if (key === 'blood_pressure_diastolic') {
      const dia = metricValue(row, 'diastolic', 'dia', 'value');
      if (dia !== undefined) mergePoint(map, ts, { dia });
      continue;
    }

    if (key === 'blood_pressure_pulse') {
      const hr = metricValue(row, 'pulse', 'hr', 'value');
      if (hr !== undefined) mergePoint(map, ts, { hr });
    }
  }

  return Array.from(map.values())
    .filter((point) =>
      [point.hr, point.spo2, point.temp_c, point.glucose, point.sys, point.dia].some(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ),
    )
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .slice(-120);
}

export async function GET(req: NextRequest) {
  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const patientId = await resolvePatientId(req);

  if (!patientId) {
    return json({
      ok: true,
      patientId: '',
      range,
      generatedAtISO: new Date().toISOString(),
      summary: {
        avgHR: null,
        avgSpO2: null,
        avgTempC: null,
        avgSys: null,
        avgDia: null,
        avgGlucose: null,
        readingCounts: {},
      },
      latest: null,
      trend: [],
      sources: {},
      message: 'Patient identity is required before vitals reports can be generated.',
    });
  }

  const rows = await loadVitals(req, patientId, range);
  const trend = normalizeTrend(rows);

  const latestTs =
    trend
      .slice()
      .reverse()
      .find((point) =>
        [point.hr, point.spo2, point.temp_c, point.glucose, point.sys, point.dia].some(
          (value) => typeof value === 'number' && Number.isFinite(value),
        ),
      )?.ts || null;

  const latestHr = latestMetric(
    rows,
    ['heart_rate', 'spo2_pulse', 'blood_pressure_pulse', 'spo2', 'blood_pressure'],
    (row) => metricValue(row, 'bpm', 'value', 'hr', 'pulse'),
  );
  const latestSpo2 = latestMetric(rows, ['spo2'], (row) =>
    metricValue(row, 'pct', 'value', 'spo2'),
  );
  const latestTemp = latestMetric(rows, ['temperature', 'temperature_celsius'], (row) =>
    metricValue(row, 'celsius', 'value', 'temp', 'temperature'),
  );
  const latestGlucose = latestMetric(rows, ['blood_glucose', 'glucose'], (row) =>
    metricValue(row, 'mgDl', 'mg_dl', 'value', 'glucose'),
  );
  const latestSys = latestMetric(rows, ['blood_pressure_systolic'], (row) =>
    metricValue(row, 'systolic', 'sys', 'value'),
  );
  const latestDia = latestMetric(rows, ['blood_pressure_diastolic'], (row) =>
    metricValue(row, 'diastolic', 'dia', 'value'),
  );

  const latest =
    trend.length > 0
      ? {
          ts: latestTs,
          hr: latestHr?.value ?? null,
          spo2: latestSpo2?.value ?? null,
          temp_c: latestTemp?.value ?? null,
          glucose: latestGlucose?.value ?? null,
          sys: latestSys?.value ?? null,
          dia: latestDia?.value ?? null,
        }
      : null;

  return json({
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    summary: {
      avgHR: average(trend.map((point) => point.hr)),
      avgSpO2: average(trend.map((point) => point.spo2)),
      avgTempC: average(trend.map((point) => point.temp_c)),
      avgSys: average(trend.map((point) => point.sys)),
      avgDia: average(trend.map((point) => point.dia)),
      avgGlucose: average(trend.map((point) => point.glucose)),
      readingCounts: {
        heart_rate: trend.filter((point) => point.hr != null).length,
        spo2: trend.filter((point) => point.spo2 != null).length,
        temperature: trend.filter((point) => point.temp_c != null).length,
        blood_pressure: trend.filter((point) => point.sys != null || point.dia != null).length,
        blood_glucose: trend.filter((point) => point.glucose != null).length,
      },
    },
    latest,
    trend,
    sources: {
      heart_rate: latestHr ? sourceFor(latestHr.row, latestHr.ts) : undefined,
      spo2: latestSpo2 ? sourceFor(latestSpo2.row, latestSpo2.ts) : undefined,
      temperature: latestTemp ? sourceFor(latestTemp.row, latestTemp.ts) : undefined,
      blood_pressure:
        latestSys || latestDia
          ? sourceFor((latestSys || latestDia)!.row, (latestSys || latestDia)!.ts)
          : undefined,
      blood_glucose: latestGlucose ? sourceFor(latestGlucose.row, latestGlucose.ts) : undefined,
    },
  });
}