import { NextRequest, NextResponse } from 'next/server';
const GATEWAY = process.env.GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest, { params }: { params: { patientId: string } }) {
  const r = await fetch(`${GATEWAY}/api/cases?patientId=${encodeURIComponent(params.patientId)}`, { cache:'no-store' });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}
