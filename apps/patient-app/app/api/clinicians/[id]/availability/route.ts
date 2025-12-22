import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getApigwBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_URL ||
    ''
  );
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const base = getApigwBase();
  if (!base) {
    return NextResponse.json({ ok: false, error: 'APIGW base not configured' }, { status: 503 });
  }

  const id = encodeURIComponent(ctx.params.id);
  const url = new URL(req.url);
  const qs = url.search ? url.search : '';

  const upstreamUrl = `${base.replace(/\/$/, '')}/api/clinicians/${id}/availability${qs}`;

  try {
    const r = await fetch(upstreamUrl, {
      cache: 'no-store',
      headers: {
        'x-role': req.headers.get('x-role') ?? 'patient',
        'x-uid': req.headers.get('x-uid') ?? 'server-user',
      },
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed' }, { status: 502 });
  }
}
