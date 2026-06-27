import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = new URL(req.url);
  const qs = new URLSearchParams();

  qs.set('type', 'blood_glucose');

  const from = u.searchParams.get('from');
  const to = u.searchParams.get('to');
  const limit = u.searchParams.get('limit');

  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  if (limit) qs.set('limit', limit);

  const base = `${u.origin}/api/v1/patients/${encodeURIComponent(params.id)}/vitals?${qs.toString()}`;
  const r = await fetch(base, {
    cache: 'no-store',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
  });

  if (!r.ok) return NextResponse.json({ items: [] });

  const j = await r.json().catch(() => ({ items: [] }));
  const items = (j.items || [])
    .map((it: any) => {
      const payload = it.payload || {};
      const glucose = toFiniteNumber(
        payload.glucose,
        payload.mgDl,
        payload.mg_dl,
        payload.value,
        it.glucose,
        it.valueNum,
        it.value,
      );

      return {
        id: it.id,
        timestamp: it.recorded_at || it.ts || it.createdAt || new Date().toISOString(),
        glucose,
        unit: payload.unit ?? it.unit ?? 'mg/dL',
        fasting: payload.fasting ?? null,
      };
    })
    .filter((row: any) => row.glucose != null);

  return NextResponse.json({ items });
}
