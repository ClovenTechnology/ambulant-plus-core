import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const base = apigwBase();
    const key = process.env.API_GATEWAY_ADMIN_KEY;
    if (!base || !key) {
      return NextResponse.json(
        { ok: false, error: 'shop_admin_proxy_not_configured' },
        { status: 500 },
      );
    }

    const response = await fetch(`${base}/api/settings/shop/media/confirm`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-admin-key': key,
      },
      body: await req.text(),
      cache: 'no-store',
    });

    const text = await response.text();
    return new NextResponse(text || JSON.stringify({ ok: response.ok }), {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'shop_media_proxy_failed' },
      { status: 502 },
    );
  }
}
