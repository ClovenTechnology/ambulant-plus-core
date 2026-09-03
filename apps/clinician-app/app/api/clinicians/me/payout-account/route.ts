import { NextRequest, NextResponse } from 'next/server';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function base() { return String(process.env.APIGW_BASE || process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || '').trim().replace(/\/+$/, ''); }
async function proxy(req: NextRequest, method: 'GET' | 'PUT') {
  const gw = base(); if (!gw) return NextResponse.json({ ok: false, error: 'missing_gateway_origin' }, { status: 500 });
  try {
    const identity = createTrustedClinicianIdentityHeader(req);
    const url = new URL(`${gw}/api/clinicians/me/payout-account`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
    const res = await fetch(url, { method, cache: 'no-store', headers: { accept: 'application/json', 'x-ambulant-identity': identity, ...(method === 'PUT' ? { 'content-type': 'application/json' } : {}) }, body: method === 'PUT' ? await req.text() : undefined });
    const text = await res.text(); return new NextResponse(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (err: any) { return NextResponse.json({ ok: false, error: err?.message || 'payout_account_proxy_failed' }, { status: typeof err?.status === 'number' ? err.status : 500 }); }
}
export async function GET(req: NextRequest) { return proxy(req, 'GET'); }
export async function PUT(req: NextRequest) { return proxy(req, 'PUT'); }
