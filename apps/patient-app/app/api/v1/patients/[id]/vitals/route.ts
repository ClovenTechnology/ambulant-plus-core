import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// simple in-memory store for dev
const g = globalThis as any;
g.__VITALS__ = g.__VITALS__ || [];
const rows: any[] = g.__VITALS__;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  const row = { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, patientId: params.id, ...body };
  rows.push(row);
  return NextResponse.json({ ok: true, item: row });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const items = rows.filter(r => r.patientId === params.id).slice(-100).reverse();
  return NextResponse.json({ items });
}
