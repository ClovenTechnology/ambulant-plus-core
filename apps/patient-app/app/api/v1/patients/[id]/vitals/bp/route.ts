import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = new URL(req.url);
  const from = u.searchParams.get('from') || '';
  const to = u.searchParams.get('to') || '';
  // Pull the generic list then filter locally for BP
  const base = `${u.origin}/api/v1/patients/${encodeURIComponent(params.id)}/vitals?from=${from}&to=${to}&type=blood_pressure`;
  const r = await fetch(base, { cache: 'no-store' });
  if (!r.ok) return NextResponse.json({ items: [] });
  const j = await r.json().catch(() => ({ items: [] }));
  // Expect items saved via emitVital({ type:'blood_pressure', payload:{ systolic, diastolic, pulse } })
  const items = (j.items || []).map((it: any) => ({
    id: it.id,
    timestamp: it.recorded_at || it.ts || it.createdAt || new Date().toISOString(),
    systolic: it.payload?.systolic ?? it.payload?.sys ?? it.sys ?? null,
    diastolic: it.payload?.diastolic ?? it.payload?.dia ?? it.dia ?? null,
    pulse: it.payload?.pulse ?? it.hr ?? null,
  })).filter((r: any) => r.systolic != null && r.diastolic != null);
  return NextResponse.json({ items });
}
