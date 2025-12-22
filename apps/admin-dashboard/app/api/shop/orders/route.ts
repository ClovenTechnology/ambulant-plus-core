// apps/admin-dashboard/app/api/shop/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return { __empty: true };
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, raw: text };
  }
}

export async function GET(req: NextRequest) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });
    }

    const key = mustEnv('API_GATEWAY_ADMIN_KEY');
    const url = new URL(req.url);

    const upstream = `${base}/api/shop/orders/admin?${url.searchParams.toString()}`;

    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-admin-key': key,
      },
    });

    const js = await safeReadJson(res);

    if ((js as any)?.__empty) {
      return NextResponse.json(
        { ok: false, error: `Upstream returned empty body (HTTP ${res.status})`, status: res.status },
        { status: 502 }
      );
    }

    if (typeof js === 'object' && js) (js as any).ok ??= res.ok;
    return NextResponse.json(js, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (admin orders)' }, { status: 502 });
  }
}
