// apps/clinician-app/app/api/careport/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = path.join(process.cwd(), 'data-careport.json');

async function readList(): Promise<any[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(list: any[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf8');
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) ?? {};
  const now = new Date().toISOString();
  const id =
    body.id || `careport-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const entry = {
    ...body,
    id,
    createdAt: body.createdAt ?? now,
    source: body.source ?? 'clinician-app',
  };

  const list = await readList();
  list.unshift(entry);
  await writeList(list);

  return NextResponse.json({ ok: true, id });
}

export async function GET() {
  const list = await readList();
  return NextResponse.json({
    items: list.slice(0, 100),
  });
}
