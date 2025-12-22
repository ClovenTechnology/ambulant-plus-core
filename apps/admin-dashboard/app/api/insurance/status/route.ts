//apps/admin-dashboard/app/api/insurance/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = path.join(process.cwd(), 'data-insurance.json');

type Insurer = {
  id: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  city?: string;
  active?: boolean;
  schemes: any[];
};

async function readList(): Promise<Insurer[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(list: Insurer[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf8');
}

export async function PATCH(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const id = String(raw.id || '').trim();
  const active =
    typeof raw.active === 'boolean' ? raw.active : undefined;

  if (!id || typeof active !== 'boolean') {
    return NextResponse.json(
      { error: 'id_and_active_required' },
      { status: 400 },
    );
  }

  const list = await readList();
  const idx = list.findIndex((i) => i.id === id);
  if (idx === -1) {
    return NextResponse.json(
      { error: 'insurer_not_found' },
      { status: 404 },
    );
  }

  list[idx].active = active;
  await writeList(list);

  return NextResponse.json({ ok: true });
}
