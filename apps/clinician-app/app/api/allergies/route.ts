//apps/clinician-app/app/api/allergies/route.ts
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
  status?: string | null; // Active | Resolved
  recordedAt?: string | null;
};

async function readStore(): Promise<Row[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    return JSON.parse(txt) as Row[];
  } catch {
    return [
      { id: 'demo-pen', patientId: 'pt-dev', substance: 'Penicillin', reaction: 'Rash / urticaria', severity: 'Moderate', status: 'Active', recordedAt: new Date().toISOString() },
      { id: 'demo-nuts', patientId: 'pt-dev', substance: 'Peanuts',    reaction: 'Lip swelling',      severity: 'Mild',     status: 'Active', recordedAt: new Date().toISOString() },
    ];
  }
}
async function writeStore(rows: Row[]) {
  await fs.writeFile(STORE, JSON.stringify(rows, null, 2), 'utf8');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId') || 'pt-dev';

  if (GW) {
    const r = await fetch(`${GW}/api/allergies?patientId=${encodeURIComponent(patientId)}`, { cache: 'no-store' })
      .catch(() => null);
    if (r?.ok) return NextResponse.json(await r.json(), { headers: { 'Cache-Control': 'no-store' } });
  }

  const rows = (await readStore()).filter(r => r.patientId === patientId);
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { patientId = 'pt-dev', substance, reaction = null, severity = null, status = 'Active' } = body || {};

  if (!substance || !String(substance).trim()) {
    return NextResponse.json({ error: 'substance is required' }, { status: 400 });
  }

  if (GW) {
    const r = await fetch(`${GW}/api/allergies`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null);
    if (r?.ok) return NextResponse.json(await r.json(), { status: r.status });
  }

  const rows = await readStore();
  const created: Row = {
    id: `alg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    patientId,
    substance: String(substance).trim(),
    reaction: reaction ? String(reaction) : null,
    severity: severity ? String(severity) : null,
    status: status ? String(status) : 'Active',
    recordedAt: new Date().toISOString(),
  };
  rows.push(created);
  await writeStore(rows);
  return NextResponse.json(created, { status: 201 });
}
