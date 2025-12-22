// apps/clinician-app/app/api/summary/[encounterId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@runtime/store';
import { readDb } from '../../erx/_lib_db_compat';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { encounterId: string } }) {
  const encounter = store.encounters.get(params.encounterId);
  if (!encounter) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

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

  // NEW: pull any persisted encounter summaries from the demo DB
  let summaries: any[] = [];
  try {
    const db = await readDb();
    const rows: any[] = Array.isArray(db.encounterSummaries) ? db.encounterSummaries : [];
    summaries = rows
      .filter(s => s.encounterId === encounter.id)
      .sort((a, b) =>
        (a.createdAt || '') > (b.createdAt || '') ? -1 : 1,
      );
  } catch (err) {
    console.error('[summary] failed to read encounterSummaries from db', err);
    summaries = [];
  }

  return NextResponse.json({
    encounter,
    appointments: appts,
    orders: { pharmacy: erx, lab },
    payments: pays,
    summaries,
  });
}
