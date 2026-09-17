// apps/patient-app/app/api/shop/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resolvePatientAppSession } from '@/app/api/_session';
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

export async function GET(req: NextRequest) {
  const session = resolvePatientAppSession();
  if (!session || session.role !== 'patient') return NextResponse.json({ ok: false, error: 'patient_identity_required' }, { status: 401 });
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });
    }

    const url = new URL(req.url);

    // uid comes from client as query param (demo-friendly).
    const uid = session.userId;

    // Do NOT forward uid as a query param upstream
    url.searchParams.delete('uid');

    // Force channel server-side
    url.searchParams.set('channel', CHANNEL);

    const upstream = `${base}/api/shop/orders?${url.searchParams.toString()}`;

    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-uid': uid,
        'x-role': 'patient',
        cookie: req.headers.get('cookie') || '',
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
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (patient orders)' }, { status: 502 });
  }
}
