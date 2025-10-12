// apps/clinician-app/app/api/pharmacy/dispense/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '../../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = await readDb();
  const i = db.erx.findIndex(r => r.id === id);
  if (i < 0) return NextResponse.json({ error: 'not found' }, { status: 404 });

  db.erx[i].status = 'dispensed';
  await writeDb(db);
  return NextResponse.json(db.erx[i]);
}
