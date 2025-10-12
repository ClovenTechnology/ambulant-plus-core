import { NextRequest, NextResponse } from 'next/server';
import { store, emitEvent } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const appt = store.appointments.get(id);
  if (!appt) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { startsAt, endsAt } = body || {};
  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: 'startsAt and endsAt required' }, { status: 400 });
  }

  appt.startsAt = startsAt;
  appt.endsAt   = endsAt;
  appt.status   = 'scheduled';
  store.appointments.set(id, appt);

  // emit event (patient, clinician, admin)
  emitEvent({
    kind: 'appointment_rescheduled',
    encounterId: appt.encounterId,
    patientId: appt.patientId,
    clinicianId: appt.clinicianId,
    payload: { apptId: appt.id, startsAt, endsAt },
    targets: { patientId: appt.patientId, clinicianId: appt.clinicianId, admin: true },
  });

  return NextResponse.json({ ok: true, appointment: appt });
}

/** Optional: keep backward-compat for old POST {startISO} callers. */
export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const legacy = await req.json().catch(() => ({}));
  if (!legacy?.startISO) {
    return NextResponse.json({ error: 'startISO required' }, { status: 400 });
  }
  // default to +30 minutes window for legacy
  const start = new Date(legacy.startISO);
  const end   = new Date(start.getTime() + 30 * 60 * 1000);
  return PUT(
    new NextRequest(req.url, {
      method: 'PUT',
      body: JSON.stringify({ startsAt: start.toISOString(), endsAt: end.toISOString() }),
      headers: { 'content-type': 'application/json' },
    }),
    ctx
  );
}
