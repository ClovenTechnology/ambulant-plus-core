import { NextRequest, NextResponse } from 'next/server';
import { forwardAuthHeaders, getGatewayBase } from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseJsonSafe(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  try {
    const gatewayBase = getGatewayBase();
    const upstream = new URL('/api/careport/marketplace/products', gatewayBase);

    req.nextUrl.searchParams.forEach((value, key) => {
      upstream.searchParams.set(key, value);
    });

    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: forwardAuthHeaders(req),
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    const data = parseJsonSafe(text);

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load CarePort marketplace products.';

    return NextResponse.json(
      { ok: false, error: message, items: [] },
      { status: 502 },
    );
  }
}