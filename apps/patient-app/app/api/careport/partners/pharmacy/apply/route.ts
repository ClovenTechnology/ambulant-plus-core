import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function apigwBase() {
  return (
    process.env.API_GATEWAY_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  headers.set('content-type', req.headers.get('content-type') || 'application/json');
  headers.set('accept', 'application/json');

  const orgId = req.headers.get('x-org-id') || process.env.DEFAULT_ORG_ID || 'org-default';
  headers.set('x-org-id', orgId);

  return headers;
}

export async function POST(req: NextRequest) {
  const base = apigwBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_base_url_missing' },
      { status: 500 },
    );
  }

  const body = await req.text();

  const res = await fetch(`${base}/api/careport/partners/pharmacy/apply`, {
    method: 'POST',
    headers: forwardHeaders(req),
    body: body || '{}',
    cache: 'no-store',
  });

  const text = await res.text();
  const contentType = res.headers.get('content-type') || 'application/json';

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}