//apps/clinician-app/app/api/training/slots/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}

export async function GET(req: NextRequest) {
  try {
    // clinicianId is not used yet, but kept for future personalization/rules.
    const clinicianId = req.nextUrl.searchParams.get('clinicianId') || '';
    if (!clinicianId) return json({ ok: false, error: 'clinicianId_required' }, 400);

    // Generate slots for next 14 days, Mon–Fri, 3 sessions/day.
    const now = new Date();
    const slots: { id: string; startAt: string; endAt: string; seatsLeft: number }[] = [];

    const sessionHours = [10, 14, 18]; // local server time
    let days = 0;
    let cursor = new Date(now);

    while (days < 14) {
      cursor = addMinutes(cursor, 24 * 60);
      if (isWeekend(cursor)) continue;

      for (const h of sessionHours) {
        const start = new Date(cursor);
        start.setHours(h, 0, 0, 0);
        const end = addMinutes(start, 60);

        const startIso = start.toISOString();
        slots.push({
          id: `slot-${start.getTime()}`,
          startAt: startIso,
          endAt: end.toISOString(),
          seatsLeft: 6,
        });
      }

      days += 1;
    }

    return json({ ok: true, slots });
  } catch (e: any) {
    console.error('GET /api/training/slots error', e);
    return json({ ok: false, error: e?.message || 'server_error' }, 500);
  }
}
