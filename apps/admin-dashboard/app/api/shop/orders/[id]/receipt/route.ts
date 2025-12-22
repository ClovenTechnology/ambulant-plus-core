// apps/admin-dashboard/app/api/shop/orders/[id]/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });
    }

    const key = mustEnv('API_GATEWAY_ADMIN_KEY');

    const id = encodeURIComponent(String(ctx?.params?.id || ''));
    const url = new URL(req.url);
    const upstream = `${base}/api/shop/orders/${id}/receipt?${url.searchParams.toString()}`;

    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: { 'x-admin-key': key },
    });

    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'text/html; charset=utf-8',
        'content-disposition': res.headers.get('content-disposition') || 'inline',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Receipt proxy failed (admin)' }, { status: 502 });
  }
}
