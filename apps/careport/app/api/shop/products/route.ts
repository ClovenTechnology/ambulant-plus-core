// apps/careport/app/api/shop/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Allow passthrough filters later if you add them
  url.searchParams.set('channel', 'careport');

  const upstream = `${apigwBase()}/api/shop?${url.searchParams.toString()}`;
  const res = await fetch(upstream, { cache: 'no-store' });

  const js = await res.json().catch(() => ({}));
  return NextResponse.json(js, { status: res.status });
}
