// apps/patient-app/app/api/charts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = '20' | '7d' | '30d' | '90d' | '1y' | 'custom';

type Point = { t: string; v: number | null };

type Series = {
  key: string;
  label: string;
  unit: string;
  kind: 'line';
  sensitive?: boolean;
  points: Point[];
  comparePoints?: Point[];
};

const SERIES_META: Record<string, { label: string; unit: string; sensitive?: boolean }> = {
  hr: { label: 'Heart rate', unit: 'bpm' },
  spo2: { label: 'SpO₂', unit: '%' },
  rr: { label: 'Respiratory rate', unit: 'rpm' },
  temp: { label: 'Temperature', unit: '°C' },
  sys: { label: 'Blood pressure systolic', unit: 'mmHg', sensitive: true },
  dia: { label: 'Blood pressure diastolic', unit: 'mmHg', sensitive: true },
  glucose: { label: 'Glucose', unit: 'mg/dL', sensitive: true },
  steps: { label: 'Steps', unit: 'steps' },
  'sleep.total': { label: 'Sleep', unit: 'h' },
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function parseRange(value: string | null): RangeKey {
  if (value === '20' || value === '7d' || value === '30d' || value === '90d' || value === '1y' || value === 'custom') {
    return value;
  }

  return '30d';
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function toIso(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;

  return new Date(parsed).toISOString();
}

function isIsoDate(value: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function filterTrendByWindow(trend: any[], range: RangeKey, startISO: string | null, endISO: string | null) {
  const now = Date.now();

  let startMs: number | null = null;
  let endMs: number | null = null;

  if (range === 'custom' && isIsoDate(startISO) && isIsoDate(endISO)) {
    startMs = Date.parse(`${startISO}T00:00:00.000Z`);
    endMs = Date.parse(`${endISO}T23:59:59.999Z`);
  }

  const filtered = trend.filter((point) => {
    const ts = toIso(point?.ts || point?.t || point?.recorded_at);
    if (!ts) return false;

    const ms = Date.parse(ts);
    if (!Number.isFinite(ms)) return false;

    if (startMs != null && ms < startMs) return false;
    if (endMs != null && ms > endMs) return false;

    if (range === '7d') return ms >= now - 7 * 24 * 60 * 60 * 1000;
    if (range === '30d') return ms >= now - 30 * 24 * 60 * 60 * 1000;
    if (range === '90d') return ms >= now - 90 * 24 * 60 * 60 * 1000;
    if (range === '1y') return ms >= now - 365 * 24 * 60 * 60 * 1000;

    return true;
  });

  if (range === '20') return filtered.slice(-20);

  return filtered;
}

function reportRangeFor(range: RangeKey) {
  if (range === '7d' || range === '30d' || range === '90d' || range === '1y') return range;
  if (range === 'custom') return '1y';
  return '30d';
}

function buildSeries(key: string, trend: any[]): Series {
  const meta = SERIES_META[key];

  const points: Point[] = trend
    .map((point) => {
      const t = toIso(point?.ts || point?.t || point?.recorded_at);
      if (!t) return null;

      let value: number | null = null;

      if (key === 'temp') {
        value = toFiniteNumber(point?.temp_c ?? point?.temp);
      } else if (key === 'sleep.total') {
        value = toFiniteNumber(point?.sleep_total ?? point?.sleepHours ?? point?.sleep?.totalHours);
      } else {
        value = toFiniteNumber(point?.[key]);
      }

      return { t, v: value };
    })
    .filter((point): point is Point => Boolean(point))
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  return {
    key,
    label: meta.label,
    unit: meta.unit,
    kind: 'line',
    sensitive: meta.sensitive,
    points,
  };
}

function coverageFor(series: Record<string, Series>) {
  const coverage: Record<string, number> = {};

  for (const [key, item] of Object.entries(series)) {
    const total = item.points.length;
    if (!total) {
      coverage[key] = 0;
      continue;
    }

    const valid = item.points.filter((point) => point.v != null).length;
    coverage[key] = Math.round((valid / total) * 100);
  }

  return coverage;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('range'));
  const startISO = url.searchParams.get('start');
  const endISO = url.searchParams.get('end');
  const patientId = String(url.searchParams.get('patientId') || '').trim();

  const reportQs = new URLSearchParams({ range: reportRangeFor(range) });
  if (patientId) reportQs.set('patientId', patientId);

  const reportRes = await fetch(`${url.origin}/api/reports/vitals?${reportQs.toString()}`, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  }).catch(() => null);

  if (!reportRes?.ok) {
    return json({
      ok: true,
      range,
      startISO: startISO || undefined,
      endISO: endISO || undefined,
      series: Object.fromEntries(
        Object.keys(SERIES_META).map((key) => [key, buildSeries(key, [])]),
      ),
      coverage: {},
      anomalies: [],
    });
  }

  const report = await reportRes.json().catch(() => null);
  const sourceTrend = Array.isArray(report?.trend) ? report.trend : [];
  const trend = filterTrendByWindow(sourceTrend, range, startISO, endISO);

  const series = Object.fromEntries(
    Object.keys(SERIES_META).map((key) => [key, buildSeries(key, trend)]),
  ) as Record<string, Series>;

  return json({
    ok: true,
    range,
    startISO: startISO || undefined,
    endISO: endISO || undefined,
    series,
    coverage: coverageFor(series),
    anomalies: [],
  });
}