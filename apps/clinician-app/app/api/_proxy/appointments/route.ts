// apps/clinician-app/app/api/_proxy/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const clinicianId = u.searchParams.get('clinicianId');
  if (!clinicianId) return NextResponse.json({ error: 'Missing clinicianId' }, { status: 400 });

  const r = await fetch(`${GATEWAY}/api/appointments?clinicianId=${encodeURIComponent(clinicianId)}`, {
    method: 'GET', headers: { 'content-type': 'application/json' }, cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}
