// (Alternate) apps/api-gateway/app/api/schedule/slots/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { addDays, startOfDay } from '@/src/time';
import { getEffectiveConsultConfig, generateSlotsForDate } from '@/src/consult/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const startStr = b.start;
  const days = Math.max(1, Math.min(62, Number(b.days || 42)));
  const clinicianId = String(b.clinicianId || '');

  if (!startStr || !clinicianId) {
    return NextResponse.json({ error: 'missing_start_or_clinicianId' }, { status: 400 });
  }

  const start = startOfDay(new Date(startStr));
  const cfg = await getEffectiveConsultConfig(clinicianId);

  const out: Record<string, any[]> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const key = d.toISOString().slice(0, 10);
    out[key] = generateSlotsForDate(d, cfg).map(s => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      label: s.label,
    }));
  }
  return NextResponse.json({ slots: out });
}
