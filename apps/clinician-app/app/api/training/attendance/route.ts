import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-ambulant-identity',
    'user-agent',
  ].forEach((k) => {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  });

  h.set('accept', 'application/json');
  h.set('content-type', 'application/json');
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const gw = gatewayBase();
    if (!gw) {
      return NextResponse.json(
        { ok: false, error: 'gateway_base_missing' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'invalid_json_body' },
        { status: 400 },
      );
    }

    const upstream = await fetch(`${gw}/api/clinicians/me/training/attendance`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[clinician-app][training/attendance][POST] upstream error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'training_attendance_failed') },
      { status: 502 },
    );
  }
}
