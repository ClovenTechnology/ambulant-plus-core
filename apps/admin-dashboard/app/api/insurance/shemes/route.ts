//apps/admin-dashboard/app/api/insurance/schemes/route.ts
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

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const insurerId = String(raw.insurerId || '').trim();
  const code = String(raw.code || '').trim();
  const name = String(raw.name || '').trim() || code;

  if (!insurerId || !code) {
    return NextResponse.json(
      { error: 'insurerId_and_code_required' },
      { status: 400 },
    );
  }

  const telemedCover: TelemedCover =
    raw.telemedCover === 'none' ||
    raw.telemedCover === 'full' ||
    raw.telemedCover === 'partial'
      ? raw.telemedCover
      : 'partial';

  const telemedCopayType =
    raw.telemedCopayType === 'fixed' ||
    raw.telemedCopayType === 'percent'
      ? raw.telemedCopayType
      : undefined;
  const telemedCopayValue =
    typeof raw.telemedCopayValue === 'number'
      ? raw.telemedCopayValue
      : undefined;

  const list = await readList();
  const idx = list.findIndex((i) => i.id === insurerId);
  if (idx === -1) {
    return NextResponse.json(
      { error: 'insurer_not_found' },
      { status: 404 },
    );
  }

  const ins = list[idx];
  const existingIdx = ins.schemes.findIndex(
    (s) => s.code.toLowerCase() === code.toLowerCase(),
  );
  const scheme: Scheme = {
    code,
    name,
    telemedCover,
    telemedCopayType,
    telemedCopayValue,
  };

  if (existingIdx >= 0) {
    ins.schemes[existingIdx] = scheme;
  } else {
    ins.schemes.push(scheme);
  }

  list[idx] = ins;
  await writeList(list);

  return NextResponse.json({ insurers: list }, { status: 201 });
}
