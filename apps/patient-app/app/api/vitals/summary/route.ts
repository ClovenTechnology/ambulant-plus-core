// apps/patient-app/app/api/vitals/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function toNum(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const res = await fetch(`${url.origin}/api/reports/vitals`, {
    cache: 'no-store',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  }).catch(() => null);

  if (!res?.ok) {
    return json(
      {
        ok: false,
        error: 'vitals_summary_unavailable',
        lastSync: null,
        lastSyncHuman: null,
        overallStatus: 'unavailable',

        // Production explicit fields
        hrNow: null,
        spo2Now: null,
        bpNow: null,
        tempNow: null,

        // Backward-compatible fields consumed by app/profile/page.tsx
        hr: null,
        spo2: null,
        bp: null,
        temp: null,

        hr24: [],
        spo224: [],
        bp24: [],
        temp24: [],
      },
      503,
    );
  }

  const report = await res.json().catch(() => null);
  const latest = report?.latest || null;
  const trend = Array.isArray(report?.trend) ? report.trend : [];

  const hr24 = trend
    .map((p: any) => toNum(p.hr))
    .filter((v: number | null): v is number => typeof v === 'number')
    .slice(-24);

  const spo224 = trend
    .map((p: any) => toNum(p.spo2))
    .filter((v: number | null): v is number => typeof v === 'number')
    .slice(-24);

  const bp24 = trend
    .map((p: any) => toNum(p.sys))
    .filter((v: number | null): v is number => typeof v === 'number')
    .slice(-24);

  const temp24 = trend
    .map((p: any) => toNum(p.temp_c))
    .filter((v: number | null): v is number => typeof v === 'number')
    .slice(-24);

  const bpText =
    latest?.sys || latest?.dia
      ? `${latest?.sys ?? '—'}/${latest?.dia ?? '—'}`
      : null;

  return json({
    ok: true,

    lastSync: latest?.ts || report?.generatedAtISO || null,
    lastSyncHuman: latest?.ts ? new Date(latest.ts).toLocaleString() : null,
    overallStatus: latest ? 'available' : 'pending',

    // Production explicit fields
    hrNow: latest?.hr ?? null,
    spo2Now: latest?.spo2 ?? null,
    bpNow:
      latest?.sys || latest?.dia
        ? { s: latest?.sys ?? null, d: latest?.dia ?? null }
        : null,
    tempNow: latest?.temp_c ?? null,

    // Backward-compatible fields consumed by app/profile/page.tsx
    hr: latest?.hr ?? null,
    spo2: latest?.spo2 ?? null,
    bp: bpText,
    temp: latest?.temp_c ?? null,

    hr24,
    spo224,
    bp24,
    temp24,
  });
}