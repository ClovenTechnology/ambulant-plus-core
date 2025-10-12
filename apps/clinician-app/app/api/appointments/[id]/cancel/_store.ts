import { NextRequest, NextResponse } from 'next/server';
import { store, emitEvent } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function PUT(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const appt = store.appointments.get(id);
  if (!appt) return NextResponse.json({ error: 'not found' }, { status: 404 });

  appt.status = 'cancelled';
  store.appointments.set(id, appt);

  emitEvent({
    kind: 'appointment_cancelled',
    encounterId: appt.encounterId,
    patientId: appt.patientId,
    clinicianId: appt.clinicianId,
    payload: { apptId: appt.id },
    targets: { patientId: appt.patientId, clinicianId: appt.clinicianId, admin: true },
  });

  return NextResponse.json({ ok: true, appointment: appt });
}
