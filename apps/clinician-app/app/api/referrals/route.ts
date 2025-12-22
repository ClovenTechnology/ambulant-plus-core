// apps/clinician-app/app/api/referrals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = path.join(process.cwd(), 'data-referrals.json');

type Referral = {
  id: string;
  createdAt: string;
  mode?: 'internal' | 'external';
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;     // internal target
  clinicianName?: string;   // internal or external name
  email?: string;           // external contact
  phone?: string;           // external contact
  [key: string]: any;
};

async function readList(): Promise<Referral[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(list: Referral[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf8');
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) ?? {};
  const now = new Date().toISOString();
  const mode: Referral['mode'] =
    body.mode ||
    (body.clinicianId ? 'internal' : body.email || body.phone ? 'external' : undefined);

  const id =
    body.id || `ref-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const entry: Referral = {
    ...body,
    id,
    createdAt: body.createdAt ?? now,
    mode,
  };

  const list = await readList();
  list.unshift(entry);
  await writeList(list);

  return NextResponse.json({ ok: true, id });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const patientIdFilter = url.searchParams.get('patientId');
  const encounterIdFilter = url.searchParams.get('encounterId');
  const modeFilter = url.searchParams.get('mode') as Referral['mode'] | null;

  let list = await readList();

  if (patientIdFilter) {
    list = list.filter((r) => String(r.patientId) === String(patientIdFilter));
  }
  if (encounterIdFilter) {
    list = list.filter(
      (r) => String(r.encounterId) === String(encounterIdFilter),
    );
  }
  if (modeFilter === 'internal' || modeFilter === 'external') {
    list = list.filter((r) => r.mode === modeFilter);
  }

  return NextResponse.json({
    items: list.slice(0, 200),
  });
}
