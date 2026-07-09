import { NextRequest, NextResponse } from 'next/server';
import { forwardJsonHeaders, getGatewayBase } from '@/app/api/careport/_gw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseJsonSafe(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const gatewayBase = getGatewayBase();
    const upstream = new URL('/api/careport/marketplace/checkout', gatewayBase);
    const body = await req.text().catch(() => '{}');

    const res = await fetch(upstream.toString(), {
      method: 'POST',
      headers: forwardJsonHeaders(req),
      body: body || '{}',
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    const data = parseJsonSafe(text);

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create CarePort marketplace order.';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}