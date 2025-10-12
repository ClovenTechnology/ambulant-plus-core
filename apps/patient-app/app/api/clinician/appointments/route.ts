// apps/patient-app/app/api/clinician/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLIN =
  process.env.CLINICIAN_BASE_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const r = await fetch(`${CLIN}/api/appointments`, { cache: 'no-store' });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'upstream_unreachable', detail: String(err?.message || err) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const r = await fetch(`${CLIN}/api/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'upstream_unreachable', detail: String(err?.message || err) }, { status: 502 });
  }
}
