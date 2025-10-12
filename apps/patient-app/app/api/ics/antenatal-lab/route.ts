// ============================================================================
// apps/patient-app/app/api/ics/antenatal-lab/route.ts
// (Unchanged from prior step; per-item lab/vaccine ICS with optional overdue RRULE)
// ============================================================================
import { NextResponse } from 'next/server';
import { buildChecklist, getChecklistItem } from '@/src/analytics/antenatal';

function toUtc(dt: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T090000Z`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const edd = searchParams.get('edd');
  const code = (searchParams.get('code') || '').toUpperCase();
  const when = (searchParams.get('when') || 'due') as 'start'|'due'|'end';
  const overdue = searchParams.get('overdue') === '1';

  if (!edd || !code) return new NextResponse('Missing edd or code', { status: 400 });
  const item = getChecklistItem(code);
  if (!item) return new NextResponse('Unknown code', { status: 400 });

  const withDates = buildChecklist(edd).find(i => i.code === code)!;
  const dateStr = when === 'start' ? withDates.startDate : when === 'end' ? withDates.endDate : withDates.dueDate;
  const dt = new Date(`${dateStr}T09:00:00Z`);

  const lines: string[] = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DueCare//AntenatalLab//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:anc-lab-${code}-${dateStr}@duecare`,
    `DTSTAMP:${toUtc(dt)}`,
    `DTSTART:${toUtc(dt)}`,
    `DTEND:${toUtc(dt)}`,
    `SUMMARY:${item.kind === 'lab' ? 'Lab' : 'Vaccine'} – ${item.name}`,
    `DESCRIPTION:Window ${withDates.startDate}–${withDates.endDate}${item.notes ? ` • ${item.notes}` : ''}`,
  ];
  if (overdue) lines.push('RRULE:FREQ=DAILY;COUNT=7');
  lines.push('END:VEVENT','END:VCALENDAR');

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename=${code.toLowerCase()}_${when}.ics`,
    },
  });
}
