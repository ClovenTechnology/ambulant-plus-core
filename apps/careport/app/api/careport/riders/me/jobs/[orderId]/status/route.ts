//apps/careport/app/api/careport/riders/me/jobs/[orderId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
  ['authorization', 'cookie', 'x-ambulant-identity', 'x-ambulant-user-id', 'x-ambulant-org-id', 'x-ambulant-role', 'x-user-id', 'x-uid', 'x-role', 'x-email', 'x-name', 'x-display-name', 'x-org-id', 'x-correlation-id', 'x-request-id'].forEach((key) => {
    const value = req.headers.get(key);
    if (value) h.set(key, value);
  });
  h.set('accept', 'application/json');
  h.set('content-type', 'application/json');
  return h;
}

async function readJson(res: Response) {
  const text = await res.text().catch(() => '');
  try { return text ? JSON.parse(text) : {}; } catch { return { ok: false, error: 'invalid_gateway_json', raw: text.slice(0, 500) }; }
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const orderId = String(params.orderId || '').trim();
  if (!orderId) return NextResponse.json({ ok: false, error: 'orderId_required' }, { status: 400 });

  try {
    const res = await fetch(`${apigwBase()}/api/careport/riders/me/jobs/${encodeURIComponent(orderId)}/status`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: await req.text(),
      cache: 'no-store',
    });
    return NextResponse.json(await readJson(res), { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'careport_rider_status_proxy_failed' }, { status: 502 });
  }
}
