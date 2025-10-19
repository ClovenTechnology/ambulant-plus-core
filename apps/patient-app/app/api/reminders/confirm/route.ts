// apps/patient-app/app/api/reminders/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

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
  return forward('/api/reminders');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forward('/api/reminders/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forward('/api/reminders', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // preserve query id parameters if present
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs ? `/api/reminders?${qs}` : '/api/reminders';
  return forward(path, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
