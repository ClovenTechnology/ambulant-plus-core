// apps/patient-app/app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';

const g = globalThis as any;
g.__ALERTS__ = g.__ALERTS__ || [];
const rows: any[] = g.__ALERTS__;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const row = { id: `al_${Date.now()}`, ts: new Date().toISOString(), ...body };
  rows.push(row);
  return NextResponse.json({ ok: true, item: row });
}

export async function GET() {
  return NextResponse.json({ items: rows.slice(-100).reverse() });
}
