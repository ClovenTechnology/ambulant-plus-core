// apps/patient-app/app/api/medications/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

async function forward(path: string, init: RequestInit = {}) {
  const url = `${APIGW.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { ...init });
  const text = await res.text().catch(() => '');
  try {
    return new NextResponse(text ? JSON.parse(text) : {}, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store', 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}

export async function GET() {
  // GET /api/medications -> forward to API gateway
  return forward('/api/medications');
}

export async function POST(req: NextRequest) {
  // create medication
  const body = await req.json().catch(() => ({}));
  return forward('/api/medications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forward('/api/medications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
