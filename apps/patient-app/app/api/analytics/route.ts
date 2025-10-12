// apps/patient-app/app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Accept lightweight analytics events from client `track()`
  const body = await req.json().catch(() => ({} as any));
  const { event, props, ts, path, ua, ref } = body || {};

  // Always ack fast to caller
  const ack = NextResponse.json({ ok: true });
  ack.headers.set('Cache-Control', 'no-store');

  // Fire-and-forget forwarding to InsightCore (if configured)
  const url = process.env.INSIGHTCORE_URL;
  const key = process.env.INSIGHTCORE_API_KEY;

  if (url) {
    const payload = {
      kind: 'analytics',
      event,
      ts: ts || Date.now(),
      path: path || req.nextUrl.pathname,
      ref: ref || null,
      ua: ua || req.headers.get('user-agent') || '',
      ip: req.headers.get('x-forwarded-for') || '',
      props: props || {},
    };

    // Do not await; we must not block the response
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(payload),
      // Node.js fetch supports `keepalive` only in Web APIs; ignore safely.
    }).catch(() => undefined);
  }

  return ack;
}
