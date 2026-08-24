// apps/careport/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardIdentityHeaders(req: NextRequest, json = false) {
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
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });
  headers.set('accept', 'application/json');
  if (json) headers.set('content-type', 'application/json');
  return headers;
}


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Force channel server-side (so client can’t spoof)
  const payload = { ...body, channel: 'careport' };

  const res = await fetch(`${apigwBase()}/api/shop/checkout`, {
    method: 'POST',
    headers: forwardIdentityHeaders(req, true),
    body: JSON.stringify(payload),
  });

  const js = await res.json().catch(() => ({}));
  return NextResponse.json(js, { status: res.status });
}