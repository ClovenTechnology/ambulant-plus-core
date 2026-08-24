// apps/clinician-app/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getUidFromReq(req: NextRequest) {
  return String(
    req.headers.get('x-uid') ||
      req.headers.get('x-user-id') ||
      req.headers.get('x-ambulant-user-id') ||
      '',
  ).trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = getUidFromReq(req);

  if (!uid) {
    return NextResponse.json({ ok: false, error: 'Clinician identity required.' }, { status: 401 });
  }

  const payload = { ...body, channel: 'clinician' };

  const res = await fetch(`${apigwBase()}/api/shop/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(uid ? { 'x-uid': uid } : {}),
    },
    body: JSON.stringify(payload),
  });

  const js = await res.json().catch(() => ({}));
  return NextResponse.json(js, { status: res.status });
}