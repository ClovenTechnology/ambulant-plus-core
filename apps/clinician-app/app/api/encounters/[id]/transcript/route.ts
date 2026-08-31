import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function gatewayBase() {
  return String(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      CANONICAL_API_GATEWAY,
  )
    .trim()
    .replace(/\/+$/, '');
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

async function buildTrustedHeaders(req: NextRequest, hasJsonBody: boolean) {
  const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
  if (!auth.ok) return { response: authErrorResponse(auth) } as const;

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return {
      response: NextResponse.json(
        { ok: false, error: clean(error?.message) || 'identity_bridge_failed' },
        { status: Number(error?.status || 500), headers: { 'cache-control': 'no-store' } },
      ),
    } as const;
  }

  const headers = new Headers({
    accept: 'application/json',
    'x-ambulant-identity': trustedIdentity,
  });
  if (hasJsonBody) headers.set('content-type', 'application/json');
  const requestId = req.headers.get('x-request-id');
  const correlationId = req.headers.get('x-correlation-id');
  if (requestId) headers.set('x-request-id', requestId);
  if (correlationId) headers.set('x-correlation-id', correlationId);
  return { headers } as const;
}

async function relay(upstream: Response) {
  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'cache-control': 'no-store' },
    });
  }
  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const encounterId = clean(params.id, 120);
  if (!encounterId) return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });

  const identity = await buildTrustedHeaders(req, false);
  if ('response' in identity) return identity.response;

  try {
    const upstream = await fetch(
      `${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/transcript`,
      { method: 'GET', headers: identity.headers, cache: 'no-store' },
    );
    return relay(upstream);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_unreachable', message: clean(error?.message) },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const encounterId = clean(params.id, 120);
  if (!encounterId) return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json_body' }, { status: 400 });
  }

  const identity = await buildTrustedHeaders(req, true);
  if ('response' in identity) return identity.response;

  try {
    const upstream = await fetch(
      `${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/transcript`,
      {
        method: 'POST',
        headers: identity.headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    );
    return relay(upstream);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_unreachable', message: clean(error?.message) },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
