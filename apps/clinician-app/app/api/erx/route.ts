// apps/clinician-app/app/api/erx/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

export async function GET() {
  // Compatibility: prefer gateway list if available; otherwise fall back to legacy local store
  if (GW) {
    const r = await fetch(`${GW}/api/erx`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) return NextResponse.json(await r.json(), { status: r.status });
  }
  // Legacy local store (unchanged behavior)
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || ''}/api/erx/outbox`, {
      cache: 'no-store'
    }).catch(() => null);
    if (r?.ok) return NextResponse.json(await r.json(), { status: 200 });
  } catch {}
  return NextResponse.json([], { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const encounterId = body?.encounterId;

  if (!encounterId) {
    return NextResponse.json(
      { ok: false, error: 'encounterId is required on /api/erx. The endpoint now routes via /api/encounters/:id/erx.' },
      { status: 400 }
    );
  }

  // Prefer API Gateway for system-of-record
  if (GW) {
    const r = await fetch(`${GW}/api/encounters/${encodeURIComponent(encounterId)}/erx`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => null);

    if (r?.ok) return NextResponse.json(await r.json(), { status: r.status });
    // If gateway fails, fall through to local route to avoid blocking clinicians.
  }

  // Local system-of-truth (same app), which writes through the encounter-aware handler you added.
  const r2 = await fetch(`${process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || ''}/api/encounters/${encodeURIComponent(encounterId)}/erx`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  }).catch(() => null);

  if (r2?.ok) return NextResponse.json(await r2.json(), { status: r2.status });

  return NextResponse.json({ ok: false, error: 'Failed to send eRx' }, { status: 502 });
}
