// apps/careport/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Force channel server-side (so client can’t spoof)
  const payload = { ...body, channel: 'careport' };

  const res = await fetch(`${apigwBase()}/api/shop/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const js = await res.json().catch(() => ({}));
  return NextResponse.json(js, { status: res.status });
}
