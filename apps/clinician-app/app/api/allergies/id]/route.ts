//apps/clinician-app/app/api/allergies/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');
const STORE = path.join(process.cwd(), 'data-allergies.json');

type Row = {
  id: string;
  patientId: string;
  substance: string;
  reaction?: string | null;
  severity?: string | null;
  status?: string | null;
  recordedAt?: string | null;
};

async function readStore(): Promise<Row[]> {
  try { return JSON.parse(await fs.readFile(STORE, 'utf8')); } catch { return []; }
}
async function writeStore(rows: Row[]) {
  await fs.writeFile(STORE, JSON.stringify(rows, null, 2), 'utf8');
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));

  if (GW) {
    const r = await fetch(`${GW}/api/allergies/${encodeURIComponent(params.id)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null);
    if (r?.ok) return NextResponse.json(await r.json(), { status: r.status });
  }

  const rows = await readStore();
  const i = rows.findIndex(r => r.id === params.id);
  if (i < 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  rows[i] = { ...rows[i], ...body };
  await writeStore(rows);
  return NextResponse.json(rows[i]);
}
