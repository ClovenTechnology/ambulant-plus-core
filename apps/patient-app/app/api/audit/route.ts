// apps/patient-app/app/api/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';

const g = globalThis as any;
g.__AUDIT__ = g.__AUDIT__ || [];
const rows: any[] = g.__AUDIT__;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const row = { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, ...body };
  rows.push(row);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ items: rows.slice(-200).reverse() });
}
