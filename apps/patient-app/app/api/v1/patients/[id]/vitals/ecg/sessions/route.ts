import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = new URL(req.url);
  const base = `${u.origin}/api/v1/patients/${encodeURIComponent(params.id)}/vitals?type=ecg&from=${u.searchParams.get('from')||''}&to=${u.searchParams.get('to')||''}`;
  const r = await fetch(base, { cache: 'no-store' });
  if (!r.ok) return NextResponse.json({ items: [] });
  const j = await r.json().catch(() => ({ items: [] }));
  // Expect items shaped like your emitVital({ type:'ecg', payload:{ durationSec, rhr, summary } })
  const items = (j.items || []).map((it: any) => ({
    id: it.id,
    start: it.recorded_at || it.ts || it.createdAt || new Date().toISOString(),
    end: it.payload?.end ?? null,
    durationSec: it.payload?.durationSec ?? null,
    summary: it.payload?.summary ?? it.meta?.summary ?? null,
  }));
  return NextResponse.json({ items });
}
