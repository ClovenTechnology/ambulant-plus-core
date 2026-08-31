// apps/clinician-app/app/api/appointments/[id]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).replace(/\/+$/, '');
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function trustedGatewayHeaders(req: NextRequest, trustedIdentity: string) {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-ambulant-identity': trustedIdentity,
  });

  const authorization = req.headers.get('authorization');
  const requestId = req.headers.get('x-request-id');
  const correlationId = req.headers.get('x-correlation-id');
  if (authorization) headers.set('authorization', authorization);
  if (requestId) headers.set('x-request-id', requestId);
  if (correlationId) headers.set('x-correlation-id', correlationId);

  return headers;
}

async function proxyReschedule(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireClinicianAuth(req, {
    allowAdmin: false,
    allowAdminStaff: false,
  });
  if (!auth.ok) return authErrorResponse(auth);

  const id = clean(params?.id);
  if (!id) return json({ ok: false, error: 'appointment_id_required' }, 400);

  const gw = gatewayBase();
  if (!gw) return json({ ok: false, error: 'api_gateway_url_missing' }, 500);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'invalid_json_body' }, 400);
  }

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return json(
      { ok: false, error: String(error?.message || 'identity_bridge_failed') },
      Number(error?.status || 500),
    );
  }

  try {
    const upstream = new URL(
      '/api/appointments/' + encodeURIComponent(id) + '/reschedule',
      gw,
    );

    const response = await fetch(upstream.toString(), {
      method: req.method === 'PUT' ? 'PUT' : 'POST',
      headers: trustedGatewayHeaders(req, trustedIdentity),
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await response.text();
    return new NextResponse(text || JSON.stringify({ ok: response.ok }), {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || 'appointment_reschedule_proxy_failed' },
      502,
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  return proxyReschedule(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  return proxyReschedule(req, ctx);
}
