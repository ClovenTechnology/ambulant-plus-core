// apps/clinician-app/app/api/_proxy/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || '';

/**
 * Local fallback store (only used when GATEWAY is not configured)
 * We keep local-only imports inside this branch to avoid bundling issues when using real gateway.
 */
if (!GATEWAY) {
  // no-op - ensures we're in dev fallback mode
}

/**
 * GET: proxy (or local list) / POST: create appointment (local only if no gateway)
 */
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const clinicianId = u.searchParams.get('clinicianId') || '';

  // If gateway configured -> proxy upstream
  if (GATEWAY) {
    const r = await fetch(`${GATEWAY}/api/appointments?clinicianId=${encodeURIComponent(clinicianId)}`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
    });
    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  // Local in-memory fallback
  try {
    // lazy import local store
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const store = await import('../../_store'); // path relative to this file
    const list = store.listAppointments ? store.listAppointments() : [];
    // If clinicianId provided, filter
    const out = clinicianId ? list.filter((a: any) => a.clinicianId === clinicianId) : list;
    return NextResponse.json(out);
  } catch (e) {
    console.error('local listAppointments error', e);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Create appointment (local dev only). If you use gateway for create, call separate gateway path.
  if (GATEWAY) {
    // forward to gateway create endpoint
    const payload = await req.json().catch(() => ({}));
    const r = await fetch(`${GATEWAY}/api/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  // Local creation
  try {
    const body = await req.json();
    // body should include clinicianId and start (ISO) plus optional patient/duration
    // import createAppointment from store
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const store = await import('../../_store');
    const created = store.createAppointment({
      clinicianId: body.clinicianId,
      startISO: body.startsAt || body.startISO || body.start,
      durationMin: body.durationMin,
      patient: body.patient,
      priceZAR: body.priceZAR,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('create appointment error', e);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
