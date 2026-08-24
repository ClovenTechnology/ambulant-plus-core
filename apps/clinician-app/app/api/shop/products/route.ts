// apps/clinician-app/app/api/shop/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      return NextResponse.json(
        { ok: false, error: 'Missing API gateway base URL (apigwBase() returned empty)' },
        { status: 500 }
      );
    }

    const url = new URL(req.url);

    // Normalize / enforce channel for this app
    url.searchParams.set('channel', 'CLINICIAN');

    const upstream = `${base}/api/shop?${url.searchParams.toString()}`;

    const uid = String(req.headers.get('x-uid') || req.headers.get('x-user-id') || req.headers.get('x-ambulant-user-id') || '').trim();
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'Clinician identity required.' }, { status: 401 });
    }

    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-role': 'clinician',
        'x-uid': uid,
      },
    });

    const js = await safeReadJson(res);

    if ((js as any)?.__empty) {
      return NextResponse.json(
        { ok: false, error: `Upstream returned an empty body (HTTP ${res.status})`, status: res.status },
        { status: 502 }
      );
    }

    // Ensure ok exists for consistent callers
    if (typeof js === 'object' && js) {
      (js as any).ok ??= res.ok;
    }

    return NextResponse.json(js, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Proxy failed (products)' },
      { status: 502 }
    );
  }
}