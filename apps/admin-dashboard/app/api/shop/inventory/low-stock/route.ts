// apps/admin-dashboard/app/api/shop/inventory/low-stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const upstream = new URL(`${apigwBase()}/api/shop/inventory/low-stock`);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const res = await fetch(upstream.toString(), { cache: 'no-store' });
  const js = await res.json().catch(() => ({}));
  return NextResponse.json(js, { status: res.status });
}
