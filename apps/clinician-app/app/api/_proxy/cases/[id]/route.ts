import { NextRequest, NextResponse } from 'next/server';
const GATEWAY = process.env.GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await fetch(`${GATEWAY}/api/cases/${params.id}`, { cache:'no-store' });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await fetch(`${GATEWAY}/api/cases/${params.id}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body: await req.text() });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}
