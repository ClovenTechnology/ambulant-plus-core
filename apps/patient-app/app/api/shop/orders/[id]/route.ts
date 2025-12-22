// apps/patient-app/app/api/shop/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHANNEL = 'PATIENT';

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return { __empty: true };
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, raw: text };
  }
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });
    }

    const url = new URL(req.url);

    // Prefer uid query param (demo-friendly); fallback to header for internal calls
    const uid =
      String(url.searchParams.get('uid') || '').trim() ||
      String(req.headers.get('x-uid') || '').trim();

    if (!uid) return NextResponse.json({ ok: false, error: 'Missing uid' }, { status: 400 });

    // Do NOT forward uid as query param upstream
    url.searchParams.delete('uid');
    url.searchParams.set('channel', CHANNEL);

    const id = encodeURIComponent(String(ctx?.params?.id || ''));
    const upstream = `${base}/api/shop/orders/${id}?${url.searchParams.toString()}`;

    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-role': 'patient',
        'x-uid': uid,
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
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (patient order detail)' }, { status: 502 });
  }
}
