// apps/patient-app/app/api/careport/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MOCK = [
  {
    status: 'REQUESTED',
    at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    status: 'PHARMACY_MATCHED',
    at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
  },
  {
    status: 'RIDER_ASSIGNED',
    at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
  {
    status: 'EN_ROUTE',
    at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    status: 'DELIVERED',
    at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

const GATEWAY_BASE =
  process.env.CAREPORT_GATEWAY_BASE ||
  process.env.CLINICIAN_BASE_URL || // optional convenience
  '';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || 'ERX-1001';

  // If no gateway configured, just serve mock.
  if (!GATEWAY_BASE) {
    return NextResponse.json({ id, timeline: MOCK, source: 'mock-no-gateway' });
  }

  const upstream = `${GATEWAY_BASE.replace(/\/+$/, '')}/api/careport/timeline?id=${encodeURIComponent(
    id,
  )}`;

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn(
        '[careport/timeline] upstream non-OK, using mock',
        res.status,
      );
      return NextResponse.json(
        { id, timeline: MOCK, source: 'mock-upstream-error' },
        { status: 200 },
      );
    }

    const json = await res.json().catch(() => null as any);

    const timeline =
      (Array.isArray(json?.timeline) && json.timeline) ||
      (Array.isArray(json?.items) && json.items) ||
      (Array.isArray(json) && json) ||
      [];

    if (!timeline.length) {
      return NextResponse.json({ id, timeline: [], source: 'live-empty' });
    }

    return NextResponse.json({ id, timeline, source: 'live' });
  } catch (err) {
    console.error('[careport/timeline] upstream error, using mock', err);
    return NextResponse.json(
      { id, timeline: MOCK, source: 'mock-exception' },
      { status: 200 },
    );
  }
}
