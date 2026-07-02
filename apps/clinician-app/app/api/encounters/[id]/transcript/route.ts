import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const FORWARD_HEADER_ALLOWLIST = [
  'authorization',
  'cookie',
  'x-ambulant-identity',
  'x-ambulant-user-id',
  'x-ambulant-role',
  'x-ambulant-org-id',
  'x-user-id',
  'x-uid',
  'x-role',
  'x-org-id',
  'x-actor-ref-id',
  'x-clinician-id',
  'x-patient-id',
];

function gatewayBase() {
  const base =
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    CANONICAL_API_GATEWAY;

  return base.replace(/\/+$/, '');
}

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function forwardHeaders(req: NextRequest, hasJsonBody: boolean) {
  const headers = new Headers();

  for (const name of FORWARD_HEADER_ALLOWLIST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set('accept', 'application/json');
  if (hasJsonBody) headers.set('content-type', 'application/json');

  return headers;
}

function responseHeaders(upstream: Response) {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set('cache-control', 'no-store');
  return headers;
}

async function relay(upstream: Response) {
  const headers = responseHeaders(upstream);
  const contentType = upstream.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await upstream.json().catch(() => null);
    return NextResponse.json(body, { status: upstream.status, headers });
  }

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, { status: upstream.status, headers });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const encounterId = clean(params.id, 120);
  if (!encounterId) return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });

  const upstreamUrl = `${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/transcript`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: forwardHeaders(req, false),
      cache: 'no-store',
    });

    return relay(upstream);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_unreachable', message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
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

  const upstreamUrl = `${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/transcript`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: forwardHeaders(req, true),
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    return relay(upstream);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_unreachable', message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
