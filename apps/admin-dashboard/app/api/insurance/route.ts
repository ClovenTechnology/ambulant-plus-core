//apps/admin-dashboard/app/api/insurance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = path.join(process.cwd(), 'data-insurance.json');

type TelemedCover = 'none' | 'partial' | 'full';

type Scheme = {
  code: string;
  name: string;
  telemedCover: TelemedCover;
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
};

type Insurer = {
  id: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  city?: string;
  active?: boolean;
  schemes: Scheme[];
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

export async function GET() {
  const insurers = await readList();
  return NextResponse.json({ insurers });
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const name = String(raw.name || '').trim();
  if (!name) {
    return NextResponse.json(
      { error: 'name_required' },
      { status: 400 },
    );
  }
  const city = String(raw.city || '').trim();
  const contact = String(raw.contact || '').trim();
  const email = String(raw.email || '').trim();
  const phone = String(raw.phone || '').trim();

  const list = await readList();
  const id = `ins-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  list.push({
    id,
    name,
    contact,
    email: email || undefined,
    phone: phone || undefined,
    city: city || undefined,
    active: true,
    schemes: [],
  });
  await writeList(list);
  return NextResponse.json({ insurers: list }, { status: 201 });
}
