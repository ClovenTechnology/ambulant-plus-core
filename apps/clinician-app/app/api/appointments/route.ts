// apps/clinician-app/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Forward to the api-gateway, but keep same-origin for the browser.
export async function GET(req: NextRequest) {
  try {
    const API = process.env.NEXT_PUBLIC_API_BASE || process.env.API || 'http://localhost:3010';
    const urlIn = new URL(req.url);
    const clinicianId = urlIn.searchParams.get('clinicianId') || '';
    const q = urlIn.searchParams.get('q') || '';
    const u = new URL(`${API}/api/appointments`);
    if (clinicianId) u.searchParams.set('clinicianId', clinicianId);
    if (q) u.searchParams.set('q', q);

    const r = await fetch(u.toString(), { cache: 'no-store' });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'upstream_failed', detail: String(e?.message || e) }, { status: 502 });
  }
}
