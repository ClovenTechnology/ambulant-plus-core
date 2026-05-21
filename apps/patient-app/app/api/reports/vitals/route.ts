// apps/patient-app/app/api/reports/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d' | '1y';

type VitalRow = {
  id?: string;
  type?: string;
  recorded_at?: string | null;
  ts?: string | null;
  createdAt?: string | null;
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
  const raw = row.recorded_at || row.ts || row.createdAt || '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseBp(payload: Record<string, any> | null | undefined) {
  const systolic = toNum(payload?.systolic, payload?.sys, payload?.sbp, payload?.high);
  const diastolic = toNum(payload?.diastolic, payload?.dia, payload?.dbp, payload?.low);
  const text = typeof payload?.bp === 'string' ? payload.bp : typeof payload?.value === 'string' ? payload.value : '';

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

function latestOf(rows: VitalRow[], type: string) {
  return rows
    .filter((row) => row.type === type)
    .sort((a, b) => Date.parse(pickTs(b) || '') - Date.parse(pickTs(a) || ''))[0];
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
  const res = await fetch(`${url.origin}/api/v1/patients/${encodeURIComponent(patientId)}/vitals?${qs.toString()}`, {
    cache: 'no-store',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  }).catch(() => null);

  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.items) ? (data.items as VitalRow[]) : [];
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

  const heartRows = rows.filter((r) => r.type === 'heart_rate');
  const spo2Rows = rows.filter((r) => r.type === 'spo2');
  const tempRows = rows.filter((r) => r.type === 'temperature');
  const glucoseRows = rows.filter((r) => r.type === 'blood_glucose' || r.type === 'glucose');
  const bpRows = rows.filter((r) => r.type === 'blood_pressure');

  const trend = rows
    .reduce<VitalsTrendPoint[]>((acc, row) => {
      const ts = pickTs(row);
      if (!ts) return acc;

      const payload = row.payload || {};

      if (row.type === 'heart_rate') {
        acc.push({ ts, hr: toNum(payload.bpm, payload.value, payload.hr) });
        return acc;
      }

      if (row.type === 'spo2') {
        acc.push({ ts, spo2: toNum(payload.pct, payload.value, payload.spo2) });
        return acc;
      }

      if (row.type === 'temperature') {
        acc.push({ ts, temp_c: toNum(payload.celsius, payload.value, payload.temp, payload.temperature) });
        return acc;
      }

      if (row.type === 'blood_glucose' || row.type === 'glucose') {
        acc.push({ ts, glucose: toNum(payload.mgDl, payload.mg_dl, payload.value, payload.glucose) });
        return acc;
      }

      if (row.type === 'blood_pressure') {
        const bp = parseBp(payload);
        acc.push({ ts, sys: bp.sys, dia: bp.dia });
      }

      return acc;
    }, [])
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .slice(-120);

  const latestHeart = latestOf(rows, 'heart_rate');
  const latestSpo2 = latestOf(rows, 'spo2');
  const latestTemp = latestOf(rows, 'temperature');
  const latestGlucose = latestOf(rows, 'blood_glucose') || latestOf(rows, 'glucose');
  const latestBp = latestOf(rows, 'blood_pressure');

  const latestBpParsed = parseBp(latestBp?.payload || null);
  const latest = rows.length
    ? {
        ts: [latestHeart, latestSpo2, latestTemp, latestGlucose, latestBp]
          .map((row) => (row ? pickTs(row) : null))
          .filter(Boolean)
          .sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] || null,
        hr: toNum(latestHeart?.payload?.bpm, latestHeart?.payload?.value, latestHeart?.payload?.hr),
        spo2: toNum(latestSpo2?.payload?.pct, latestSpo2?.payload?.value, latestSpo2?.payload?.spo2),
        temp_c: toNum(latestTemp?.payload?.celsius, latestTemp?.payload?.value, latestTemp?.payload?.temp, latestTemp?.payload?.temperature),
        glucose: toNum(latestGlucose?.payload?.mgDl, latestGlucose?.payload?.mg_dl, latestGlucose?.payload?.value, latestGlucose?.payload?.glucose),
        sys: latestBpParsed.sys,
        dia: latestBpParsed.dia,
      }
    : null;

  const bpParsed = bpRows.map((row) => parseBp(row.payload));

  return json({
    ok: true,
    patientId,
    range,
    generatedAtISO: new Date().toISOString(),
    summary: {
      avgHR: average(heartRows.map((row) => toNum(row.payload?.bpm, row.payload?.value, row.payload?.hr))),
      avgSpO2: average(spo2Rows.map((row) => toNum(row.payload?.pct, row.payload?.value, row.payload?.spo2))),
      avgTempC: average(tempRows.map((row) => toNum(row.payload?.celsius, row.payload?.value, row.payload?.temp, row.payload?.temperature))),
      avgSys: average(bpParsed.map((bp) => bp.sys)),
      avgDia: average(bpParsed.map((bp) => bp.dia)),
      avgGlucose: average(glucoseRows.map((row) => toNum(row.payload?.mgDl, row.payload?.mg_dl, row.payload?.value, row.payload?.glucose))),
      readingCounts: {
        heart_rate: heartRows.length,
        spo2: spo2Rows.length,
        temperature: tempRows.length,
        blood_pressure: bpRows.length,
        blood_glucose: glucoseRows.length,
      },
    },
    latest,
    trend,
    sources: {
      heart_rate: latestHeart ? { source: 'patient-vitals', recorded_at: pickTs(latestHeart) } : undefined,
      spo2: latestSpo2 ? { source: 'patient-vitals', recorded_at: pickTs(latestSpo2) } : undefined,
      temperature: latestTemp ? { source: 'patient-vitals', recorded_at: pickTs(latestTemp) } : undefined,
      blood_pressure: latestBp ? { source: 'patient-vitals', recorded_at: pickTs(latestBp) } : undefined,
      blood_glucose: latestGlucose ? { source: 'patient-vitals', recorded_at: pickTs(latestGlucose) } : undefined,
    },
  });
}
