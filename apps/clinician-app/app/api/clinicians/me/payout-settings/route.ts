// apps/clinician-app/app/api/clinicians/me/payout-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  '';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}


async function proxy(req: NextRequest, method: 'GET' | 'PUT') {
  if (!GW) return json({ ok: false, error: 'missing_gateway_origin' }, 500);
  let identity: string;
  try { identity = createTrustedClinicianIdentityHeader(req); }
  catch (err: any) { return json({ ok: false, error: err?.message || 'unauthenticated' }, typeof err?.status === 'number' ? err.status : 401); }
  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: { accept: 'application/json', 'x-ambulant-identity': identity },
  };
  if (method === 'PUT') {
    (init.headers as any)['content-type'] = 'application/json';
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }
  const res = await fetch(`${GW}/api/clinicians/me/payout-settings`, init);
  const body = await res.json().catch(() => ({}));
  return json(body, res.status);
}

export async function GET(req: NextRequest) {
  try {
    return await proxy(req, 'GET');
  } catch (err: any) {
    console.error('[clinician-app] payout settings proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    return await proxy(req, 'PUT');
  } catch (err: any) {
    console.error('[clinician-app] payout settings save proxy failed', err);
    return json({ ok: false, error: err?.message || 'gateway_failed' }, 500);
  }
}
