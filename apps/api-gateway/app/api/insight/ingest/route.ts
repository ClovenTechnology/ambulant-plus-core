// apps/api-gateway/app/api/insight/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Prefer server-only env; fall back to NEXT_PUBLIC for back-compat
const CORE =
  process.env.INSIGHTCORE_URL ||
  process.env.NEXT_PUBLIC_INSIGHTCORE_URL ||
  'http://localhost:8788';

const KEY =
  process.env.INSIGHTCORE_KEY ||
  process.env.NEXT_PUBLIC_INSIGHTCORE_KEY ||
  '';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // If caller sent its own Authorization, pass it through; else use KEY if present
  const auth = req.headers.get('authorization') || (KEY ? `Bearer ${KEY}` : undefined);

  const r = await fetch(`${CORE.replace(/\/+$/,'')}/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: `InsightCore ${r.status}`, detail: text || undefined },
      { status: 500 }
    );
  }

  const j = await r.json().catch(() => ({}));
  return NextResponse.json({ ok: true, ...j });
}
