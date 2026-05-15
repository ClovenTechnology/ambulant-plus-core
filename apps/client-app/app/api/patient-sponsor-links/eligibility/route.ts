import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default';
const DEFAULT_CLIENT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_CLIENT_ID || 'client-demo-medical-aid';

function apiBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    'http://localhost:3010'
  ).replace(/\/+$/, '');
}

function trustedHeaders(req: NextRequest) {
  const h = new Headers();

  h.set('accept', 'application/json');
  h.set('content-type', 'application/json');
  h.set('x-ambulant-trusted', 'client-app-proxy');
  h.set(
    'x-ambulant-user-id',
    req.headers.get('x-ambulant-user-id') || 'admin@medicalaid.demo',
  );
  h.set(
    'x-ambulant-org-id',
    req.headers.get('x-ambulant-org-id') || DEFAULT_ORG_ID,
  );
  h.set(
    'x-ambulant-role',
    req.headers.get('x-ambulant-role') || 'ORG_OWNER',
  );
  h.set(
    'x-ambulant-workspace',
    req.headers.get('x-ambulant-workspace') || 'payer_ops',
  );

  return h;
}

async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  const incoming = new URL(req.url);
  const target = new URL('/api/patient-sponsor-links/eligibility', apiBase());

  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  if (!target.searchParams.get('orgId')) target.searchParams.set('orgId', DEFAULT_ORG_ID);
  if (!target.searchParams.get('clientId')) target.searchParams.set('clientId', DEFAULT_CLIENT_ID);

  const init: RequestInit = {
    method,
    headers: trustedHeaders(req),
    cache: 'no-store',
  };

  if (method === 'POST') {
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }

  try {
    const res = await fetch(target.toString(), init);
    const payload = await res.json().catch(() => ({}));
    return NextResponse.json(payload, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'eligibility_proxy_failed' },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}