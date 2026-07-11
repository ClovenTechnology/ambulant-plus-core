import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function forwardHeaders(req: NextRequest, hasBody = false) {
  const headers = new Headers();

  const pass = [
    'authorization',
    'cookie',
    'x-user-id',
    'x-user-role',
    'x-user-roles',
    'x-org-id',
    'x-tenant-id',
    'x-correlation-id',
  ];

  for (const key of pass) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (hasBody) headers.set('content-type', 'application/json');

  return headers;
}

export async function GET(req: NextRequest) {
  const upstream = new URL(`${apigwBase()}/api/careport/admin/commercial-policy`);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'careport_commercial_policy_proxy_failed',
      },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const upstream = new URL(`${apigwBase()}/api/careport/admin/commercial-policy`);
  const body = await req.text();

  try {
    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardHeaders(req, true),
      body: body || '{}',
      cache: 'no-store',
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'careport_commercial_policy_proxy_failed',
      },
      { status: 502 },
    );
  }
}