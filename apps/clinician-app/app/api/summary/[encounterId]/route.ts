import { NextRequest, NextResponse } from 'next/server';
import { store } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { encounterId: string } }) {
  const encounter = store.encounters.get(params.encounterId);
  if (!encounter) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const appts = Array.from(store.appointments.values())
    .filter(a => a.encounterId === encounter.id)
    .sort((a, b) => (a.startsAt > b.startsAt ? -1 : 1));

  const erx = Array.from(store.erxOrders.values())
    .filter(o => o.encounterId === encounter.id)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  const lab = Array.from(store.labOrders.values())
    .filter(o => o.encounterId === encounter.id)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  const pays = Array.from(store.payments.values())
    .filter(p => p.caseId === encounter.caseId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return NextResponse.json({
    encounter,
    appointments: appts,
    orders: { pharmacy: erx, lab },
    payments: pays,
  });
}
