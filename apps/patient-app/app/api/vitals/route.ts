// apps/patient-app/app/api/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PublicVital = {
  ts: string;
  hr?: number;
  spo2?: number;
  temp_c?: number;
  sys?: number;
  dia?: number;
  glucose?: number;
  source?: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function toNum(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeTrendPoint(point: any): PublicVital | null {
  const rawTs = String(point?.ts || point?.recorded_at || point?.createdAt || '').trim();
  const parsedTs = Date.parse(rawTs);
  if (!Number.isFinite(parsedTs)) return null;

  const item: PublicVital = {
    ts: new Date(parsedTs).toISOString(),
  };

  const hr = toNum(point?.hr);
  const spo2 = toNum(point?.spo2);
  const temp = toNum(point?.temp_c ?? point?.temp);
  const sys = toNum(point?.sys);
  const dia = toNum(point?.dia);
  const glucose = toNum(point?.glucose);

  if (hr !== undefined) item.hr = hr;
  if (spo2 !== undefined) item.spo2 = spo2;
  if (temp !== undefined) item.temp_c = temp;
  if (sys !== undefined) item.sys = sys;
  if (dia !== undefined) item.dia = dia;
  if (glucose !== undefined) item.glucose = glucose;

  if (typeof point?.source === 'string' && point.source.trim()) {
    item.source = point.source.trim();
  }

  return Object.keys(item).length > 1 ? item : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = url.searchParams.get('range') || '30d';
  const patientId = url.searchParams.get('patientId') || '';

  const qs = new URLSearchParams({ range });
  if (patientId) qs.set('patientId', patientId);

  const res = await fetch(`${url.origin}/api/reports/vitals?${qs.toString()}`, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  }).catch(() => null);

  if (!res?.ok) {
    return json([], 200);
  }

  const payload = await res.json().catch(() => null);
  const trend = Array.isArray(payload?.trend) ? payload.trend : [];

  const items = trend
    .map((point: any) => normalizeTrendPoint(point))
    .filter((point: PublicVital | null): point is PublicVital => Boolean(point))
    .sort((a: PublicVital, b: PublicVital) => Date.parse(b.ts) - Date.parse(a.ts));

  return json(items);
}

export async function POST() {
  return json(
    {
      ok: false,
      error: 'vitals_write_route_deprecated',
      message:
        'Vitals must be written through /api/v1/patients/[id]/vitals so they are persisted against the active patient record.',
    },
    410,
  );
}
