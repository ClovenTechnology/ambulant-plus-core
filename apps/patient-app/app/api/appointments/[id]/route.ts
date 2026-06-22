// apps/patient-app/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    'https://ambulant-plus-core-api-gateway-kdon.vercel.app'
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-org',
    'x-org-id',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-correlation-id',
    'x-request-id',
  ]) {
    const value = req.headers.get(key);
    if (value) h.set(key, value);
  }

  h.set('accept', 'application/json');
  if (!h.get('x-role') && !h.get('x-ambulant-role')) h.set('x-role', 'patient');
  return h;
}

async function relay(res: Response) {
  const text = await res.text();
  return new NextResponse(text || JSON.stringify({ ok: res.ok }), {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = String(params.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'appointment_id_required' }, { status: 400 });
    }

    const upstream = new URL('/api/appointments/' + encodeURIComponent(id), gatewayBase());
    const res = await fetch(upstream.toString(), {
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    return relay(res);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'appointment_detail_proxy_failed' },
      { status: 502 },
    );
  }
}
