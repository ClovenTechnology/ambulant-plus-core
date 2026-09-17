// apps/clinician-app/app/api/shop/orders/[id]/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json(
        { ok: false, error: 'Missing API gateway base URL (apigwBase() returned empty)' },
        { status: 500 }
      );
    }

    const id = encodeURIComponent(String(ctx?.params?.id || ''));
    const url = new URL(req.url);

    const upstream = `${base}/api/shop/orders/${id}/receipt?${url.searchParams.toString()}`;

    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: { 'x-ambulant-identity': createTrustedClinicianIdentityHeader(req) },
    });
    const body = await res.text();

    // Even if upstream returns HTML/PDF, we pass it through
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'text/html; charset=utf-8',
        'content-disposition': res.headers.get('content-disposition') || 'inline',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Receipt proxy failed' },
      { status: 502 }
    );
  }
}
