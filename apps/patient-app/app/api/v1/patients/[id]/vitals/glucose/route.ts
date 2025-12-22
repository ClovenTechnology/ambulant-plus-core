import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = new URL(req.url);
  const base = `${u.origin}/api/v1/patients/${encodeURIComponent(params.id)}/vitals?type=blood_glucose&from=${u.searchParams.get('from')||''}&to=${u.searchParams.get('to')||''}`;
  const r = await fetch(base, { cache: 'no-store' });
  if (!r.ok) return NextResponse.json({ items: [] });
  const j = await r.json().catch(() => ({ items: [] }));
  const items = (j.items || []).map((it: any) => ({
    id: it.id,
    timestamp: it.recorded_at || it.ts || it.createdAt || new Date().toISOString(),
    glucose: it.payload?.glucose ?? it.glucose ?? null,
    unit: it.payload?.unit ?? it.unit ?? 'mg/dL',
    fasting: it.payload?.fasting ?? null,
  })).filter((r: any) => r.glucose != null);
  return NextResponse.json({ items });
}
