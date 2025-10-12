import { NextRequest, NextResponse } from 'next/server';
import { store } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function PUT(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const appt = store.appointments.get(id);
  if (!appt) return NextResponse.json({ error: 'not found' }, { status: 404 });

  appt.status = 'cancelled';
  appt.endsAt = appt.endsAt || new Date().toISOString();
  store.appointments.set(id, appt);

  return NextResponse.json({ ok: true, appointment: appt });
}
