// apps/patient-app/app/api/medical-aids/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Store at repo root so clinician-app can also read it (dev convenience)
const STORE = path.resolve(process.cwd(), '../../medical-aids.json');

type TelemedCover = 'none' | 'full' | 'partial';

type MedicalAid = {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  payerName: string;
  planName?: string;
  membershipNumber: string;
  dependentCode?: string;
  principalName?: string;
  principalIdNumber?: string;
  telemedCover: TelemedCover;
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
  comFilePath?: string;
  comFileName?: string;
  notes?: string;
  active?: boolean;
  [key: string]: any;
};

function corsOrigin() {
  return process.env.MEDICALAID_CORS_ORIGIN || '*';
}

async function readList(): Promise<MedicalAid[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(list: MedicalAid[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf8');
}

function cors(json: any, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: {
      'access-control-allow-origin': corsOrigin(),
      'cache-control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId') || undefined;

  let list = await readList();
  if (patientId) {
    list = list.filter((m) => String(m.patientId) === String(patientId));
  }

  list.sort((a, b) => {
    const aTs = Date.parse(a.updatedAt || a.createdAt || '');
    const bTs = Date.parse(b.updatedAt || b.createdAt || '');
    return (Number.isNaN(bTs) ? 1 : 0) - (Number.isNaN(aTs) ? 1 : 0) || bTs - aTs;
  });

  return cors({ ok: true, items: list });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Partial<MedicalAid>;
  const patientId = String(b.patientId || 'pt-za-001');
  const payerName = String(b.payerName || '').trim();
  const membershipNumber = String(b.membershipNumber || '').trim();

  if (!payerName || !membershipNumber) {
    return cors({ ok: false, error: 'payerName_and_membershipNumber_required' }, 400);
  }

  const now = new Date().toISOString();
  const id =
    b.id && String(b.id).trim()
      ? String(b.id).trim()
      : `med-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const list = await readList();

  const entry: MedicalAid = {
    id,
    patientId,
    createdAt: b.createdAt || now,
    updatedAt: now,
    payerName,
    planName: b.planName ?? '',
    membershipNumber,
    dependentCode: b.dependentCode ?? '',
    principalName: b.principalName ?? '',
    principalIdNumber: b.principalIdNumber ?? '',
    telemedCover: (b.telemedCover as TelemedCover) ?? 'partial',
    telemedCopayType: b.telemedCopayType ?? undefined,
    telemedCopayValue: typeof b.telemedCopayValue === 'number' ? b.telemedCopayValue : undefined,
    comFilePath: b.comFilePath ?? undefined,
    comFileName: b.comFileName ?? undefined,
    notes: b.notes ?? '',
    active: b.active ?? (list.filter((m) => m.patientId === patientId).length === 0),
  };

  if (entry.active) {
    for (const m of list) {
      if (m.patientId === patientId && m.id !== entry.id) {
        m.active = false;
        m.updatedAt = now;
      }
    }
  }

  list.push(entry);
  await writeList(list);

  return cors({ ok: true, item: entry }, 201);
}

export async function PUT(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Partial<MedicalAid>;
  const id = String(b.id || '').trim();
  if (!id) return cors({ ok: false, error: 'id_required' }, 400);

  const list = await readList();
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return cors({ ok: false, error: 'not_found' }, 404);

  const now = new Date().toISOString();
  const existing = list[idx];

  const updated: MedicalAid = {
    ...existing,
    ...b,
    id: existing.id,
    updatedAt: now,
  };

  list[idx] = updated;

  if (b.active === true) {
    for (const m of list) {
      if (m.patientId === updated.patientId && m.id !== updated.id) {
        m.active = false;
        m.updatedAt = now;
      }
    }
  }

  await writeList(list);
  return cors({ ok: true, item: updated });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return cors({ ok: false, error: 'id_required' }, 400);

  const list = await readList();
  const next = list.filter((m) => m.id !== id);
  await writeList(next);

  return cors({ ok: true });
}

export function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'access-control-allow-origin': corsOrigin(),
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,x-uid,x-role',
        'cache-control': 'no-store',
      },
    },
  );
}
