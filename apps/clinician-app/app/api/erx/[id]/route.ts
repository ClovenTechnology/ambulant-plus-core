// apps/clinician-app/app/api/erx/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '../../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const db = await readDb();
  const rx = db.erx.find(r => r.id === params.id);
  if (!rx) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(rx);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const db = await readDb();
  const i = db.erx.findIndex(r => r.id === params.id);
  if (i < 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  db.erx[i] = { ...db.erx[i], ...body };
  await writeDb(db);
  return NextResponse.json(db.erx[i]);
}
