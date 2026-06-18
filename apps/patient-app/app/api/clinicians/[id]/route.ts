import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getApigwBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://api-gateway.ambulantplus.co.za' : '')
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  [
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
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });

  headers.set('accept', 'application/json');

  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) {
    headers.set('x-role', 'patient');
  }

  if (!headers.get('x-org-id') && !headers.get('x-ambulant-org-id')) {
    headers.set('x-org-id', process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default');
  }

  return headers;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const base = getApigwBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const id = encodeURIComponent(ctx.params.id);
  const upstreamUrl = `${base}/api/clinicians/${id}`;

  try {
    const r = await fetch(upstreamUrl, {
      cache: 'no-store',
      headers: forwardHeaders(req),
    });

    const text = await r.text();

    return new NextResponse(text || '{}', {
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'clinician_detail_proxy_failed' },
      { status: 502 },
    );
  }
}
