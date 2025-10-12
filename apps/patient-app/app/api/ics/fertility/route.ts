// apps/patient-app/app/api/ics/fertility/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDT(iso: string) {
  const d = new Date(iso + 'T09:00:00Z'); // 09:00Z for all-day-ish events
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const da = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${da}T${hh}${mm}${ss}Z`;
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const lmp = req.nextUrl.searchParams.get('lmp');
  const cycleDays = Number(req.nextUrl.searchParams.get('cycleDays') || '0');

  if (!lmp || !/^\d{4}-\d{2}-\d{2}$/.test(lmp) || !Number.isFinite(cycleDays) || cycleDays < 20 || cycleDays > 40) {
    return new NextResponse('Invalid parameters', { status: 400 });
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DueCare//Fertility//EN',
    'CALSCALE:GREGORIAN',
  ];

  // Generate 12 upcoming cycles
  let start = lmp;
  const cycles = 12;
  for (let i = 0; i < cycles; i++) {
    const nextStart = i === 0 ? start : addDays(lmp, i * cycleDays);

    // Period event (5 days)
    const periodStart = nextStart;
    const periodEnd = addDays(periodStart, 5);

    lines.push(
      'BEGIN:VEVENT',
      `UID:period-${periodStart}@duecare`,
      `DTSTAMP:${toDT(periodStart)}`,
      `DTSTART:${toDT(periodStart)}`,
      `DTEND:${toDT(periodEnd)}`,
      'SUMMARY:Period (predicted)',
      'END:VEVENT',
    );

    // Ovulation & Fertile window
    const ovulation = addDays(nextStart, -14);
    const fertileStart = addDays(ovulation, -5);
    const fertileEnd = addDays(ovulation, 1);

    lines.push(
      'BEGIN:VEVENT',
      `UID:fertile-${fertileStart}@duecare`,
      `DTSTAMP:${toDT(fertileStart)}`,
      `DTSTART:${toDT(fertileStart)}`,
      `DTEND:${toDT(fertileEnd)}`,
      'SUMMARY:Fertile Window (predicted)',
      'END:VEVENT',
      'BEGIN:VEVENT',
      `UID:ovulation-${ovulation}@duecare`,
      `DTSTAMP:${toDT(ovulation)}`,
      `DTSTART:${toDT(ovulation)}`,
      `DTEND:${toDT(addDays(ovulation, 1))}`,
      'SUMMARY:Estimated Ovulation',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  const body = lines.join('\r\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'no-store',
      'content-disposition': 'inline; filename="fertility_subscribe.ics"',
    },
  });
}
