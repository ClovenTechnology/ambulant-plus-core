// apps/patient-app/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function getGatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    process.env.NEXT_PUBLIC_GATEWAY_BASE ||
    ''
  ).replace(/\/+$/, '');
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gateway = getGatewayBase();

  if (!gateway) {
    return NextResponse.json({ error: 'API gateway is not configured.' }, { status: 503 });
  }

  const id = encodeURIComponent(params.id);
  const res = await fetch(`${gateway}/api/orders/${id}`, {
    cache: 'no-store',
    headers: { 'x-role': 'patient' },
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: res.status });
}
