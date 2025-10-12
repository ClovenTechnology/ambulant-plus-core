// apps/clinician-app/app/api/insightcore/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Prefer server-only env; fall back to NEXT_PUBLIC for back-compat.
const GW  = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || process.env.NEXT_PUBLIC_GATEWAY_BASE || '';
const CORE =
  process.env.INSIGHTCORE_URL ||
  process.env.NEXT_PUBLIC_INSIGHTCORE_URL ||
  'http://localhost:8788';
const KEY =
  process.env.INSIGHTCORE_KEY ||
  process.env.NEXT_PUBLIC_INSIGHTCORE_KEY ||
  '';

export async function GET() {
  return NextResponse.json({ ok: true, service: 'InsightCore proxy' });
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const auth = req.headers.get('authorization') || (KEY ? `Bearer ${KEY}` : undefined);

  // Prefer proxying through the gateway if defined, else talk to InsightCore directly.
  const target = GW
    ? `${GW.replace(/\/+$/, '')}/api/insight/ingest`
    : `${CORE.replace(/\/+$/, '')}/ingest`;

  try {
    const r = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: auth } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const js = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ ok: false, error: js?.error || `Upstream ${r.status}` }, { status: 500 });
    return NextResponse.json(js);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'insightcore_error' }, { status: 500 });
  }
}
