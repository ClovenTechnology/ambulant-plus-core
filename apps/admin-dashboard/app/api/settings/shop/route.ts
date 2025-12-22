// apps/admin-dashboard/app/api/settings/shop/route.ts
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

function jsonOrEmpty(body: any) {
  try {
    return JSON.stringify(body ?? {});
  } catch {
    return JSON.stringify({});
  }
}

export async function GET(req: NextRequest) {
  try {
    const base = apigwBase();
    if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });

    const key = mustEnv('API_GATEWAY_ADMIN_KEY');

    const upstream = new URL(`${base}/api/settings/shop`);
    const url = new URL(req.url);
    url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: { accept: 'application/json', 'x-admin-key': key },
    });

    const js = await safeReadJson(res);
    if ((js as any)?.__empty) {
      return NextResponse.json({ ok: false, error: `Upstream returned empty body (HTTP ${res.status})`, status: res.status }, { status: 502 });
    }
    if (typeof js === 'object' && js) (js as any).ok ??= res.ok;

    return NextResponse.json(js, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (settings GET)' }, { status: 502 });
  }
}

async function forwardWithBody(req: NextRequest, method: 'POST' | 'PATCH' | 'DELETE') {
  const base = apigwBase();
  if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });

  const key = mustEnv('API_GATEWAY_ADMIN_KEY');
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${base}/api/settings/shop`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-admin-key': key,
    },
    body: jsonOrEmpty(body),
    cache: 'no-store',
  });

  const js = await safeReadJson(res);
  if ((js as any)?.__empty) {
    return NextResponse.json({ ok: false, error: `Upstream returned empty body (HTTP ${res.status})`, status: res.status }, { status: 502 });
  }
  if (typeof js === 'object' && js) (js as any).ok ??= res.ok;

  return NextResponse.json(js, { status: res.status });
}

export async function POST(req: NextRequest) {
  try {
    return await forwardWithBody(req, 'POST');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (settings POST)' }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    return await forwardWithBody(req, 'PATCH');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (settings PATCH)' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    return await forwardWithBody(req, 'DELETE');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (settings DELETE)' }, { status: 502 });
  }
}
