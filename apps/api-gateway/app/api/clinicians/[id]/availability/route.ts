// apps/api-gateway/app/api/clinicians/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

// naive hh:mm → UTC Date for a given day (assumes clinician TZ ~ Africa/Johannesburg; adjust per-profile if stored)
function hhmmToUtcOnDay(day: Date, hhmm: string) {
  const [hh, mm] = hhmm.split(':').map(Number);
  // build local day at midnight then add hh:mm, then convert to UTC by using Date with that clock in UTC
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm));
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = new URL(req.url);
    const days = Math.min(30, Math.max(1, Number(u.searchParams.get('days') || '14')));
    const slot = Math.min(120, Math.max(10, Number(u.searchParams.get('slot') || '30')));
    const fromStr = u.searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const from = new Date(`${fromStr}T00:00:00.000Z`);

    // TODO: call clinician-app schedule; for now, default window:
    const min = '08:00';
    const max = '17:00';

    const rangeEnd = new Date(from.getTime() + days * 86400000);

    const conflicts = await prisma.appointment.findMany({
      where: {
        clinicianId: params.id,
        status: { in: ['scheduled', 'reserved', 'confirmed', 'pending'] },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: Array<{ start: string; end: string }> = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(from.getTime() + i * 86400000);
      const dayStart = hhmmToUtcOnDay(day, min);
      const dayEnd = hhmmToUtcOnDay(day, max);
      for (let t = dayStart.getTime(); t < dayEnd.getTime(); t += slot * 60000) {
        const s = new Date(t);
        const e = new Date(t + slot * 60000);
        const clash = conflicts.some((c) => c.startsAt < e && c.endsAt > s);
        if (!clash) slots.push({ start: s.toISOString(), end: e.toISOString() });
      }
    }

    return NextResponse.json({ slots }, {
      headers: {
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'failed', detail: e?.message || String(e) }, { status: 500, headers: { 'access-control-allow-origin': '*' } });
  }
}
