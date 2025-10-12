// apps/clinician-app/app/api/erx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, Erx } from '../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

export async function GET() {
  if (GW) {
    const r = await fetch(`${GW}/api/erx`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) return NextResponse.json(await r.json());
  }
  // fallback: legacy file DB
  const db = await readDb();
  return NextResponse.json(db.erx);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // If we have gateway, forward in a backward-compatible shape
  if (GW) {
    const r = await fetch(`${GW}/api/erx`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (r?.ok) return NextResponse.json(await r.json(), { status: r.status });
    // fall through to local mock if gw failed
  }

  // ---- fallback legacy mock (unchanged) ----
  if (!body.appointmentId || !Array.isArray(body.meds))
    return NextResponse.json({ error: 'appointmentId & meds[] required' }, { status: 400 });

  const db = await readDb();
  const appt = db.appointments.find(a => a.id === body.appointmentId);
  if (!appt) return NextResponse.json({ error: 'appointment not found' }, { status: 404 });

  const erx: Erx = {
    id: `rx-${Math.random().toString(36).slice(2,10)}`,
    appointmentId: appt.id,
    patientName: appt.patientName,
    clinicianName: appt.clinicianName,
    meds: body.meds,
    status: 'sent',
    createdAt: new Date().toISOString(),
    dispenseCode: Math.random().toString(36).slice(2,7).toUpperCase(),
  };

  db.erx.unshift(erx);
  await writeDb(db);
  return NextResponse.json(erx, { status: 201 });
}
