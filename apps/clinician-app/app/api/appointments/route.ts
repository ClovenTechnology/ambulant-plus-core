import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).replace(/\/$/, '');
}

function missingGatewayResponse() {
  return NextResponse.json(
    { ok: false, error: 'api_gateway_url_missing' },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  const gateway = gatewayBase();
  if (!gateway) return missingGatewayResponse();

  try {
    const urlIn = new URL(req.url);
    const upstream = new URL('/api/appointments', gateway);

    urlIn.searchParams.forEach((value, key) => {
      upstream.searchParams.append(key, value);
    });

    const r = await fetch(upstream.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    const body = await r.text();

    return new NextResponse(body, {
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'appointments_upstream_failed', detail: String(e?.message || e) },
      { status: 502 }
    );
  }
}
