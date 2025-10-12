// apps/patient-app/app/api/allergies/route.ts
import { NextResponse } from 'next/server';

export type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string; // ISO
};

let ALLERGIES: Allergy[] = [
  {
    id: crypto.randomUUID(),
    substance: 'Penicillin',
    reaction: 'Rash',
    severity: 'Moderate',
    status: 'Active',
    notedAt: new Date(Date.now() - 86400000 * 120).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    substance: 'Peanuts',
    reaction: 'Anaphylaxis',
    severity: 'Severe',
    status: 'Resolved',
    notedAt: new Date(Date.now() - 86400000 * 600).toISOString(),
  },
];

// GET: list
export async function GET() {
  return NextResponse.json(ALLERGIES);
}

// POST: add { substance, reaction, severity }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { substance, reaction, severity } = body ?? {};
  if (!substance || !reaction || !severity) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });
  }
  const row: Allergy = {
    id: crypto.randomUUID(),
    substance: String(substance),
    reaction: String(reaction),
    severity: ['Mild','Moderate','Severe'].includes(severity) ? severity : 'Mild',
    status: 'Active',
    notedAt: new Date().toISOString(),
  };
  ALLERGIES.unshift(row);
  return NextResponse.json({ ok: true, row });
}

// PATCH: toggle status { id, status }
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, status } = body ?? {};
  const idx = ALLERGIES.findIndex(a => a.id === id);
  if (idx < 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (status && (status === 'Active' || status === 'Resolved')) {
    ALLERGIES[idx].status = status;
  }
  return NextResponse.json({ ok: true, row: ALLERGIES[idx] });
}
