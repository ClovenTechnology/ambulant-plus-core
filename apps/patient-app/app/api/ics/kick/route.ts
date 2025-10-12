// ============================================================================
// apps/patient-app/app/api/ics/kick/route.ts
// Daily recurring ICS for fetal kick count reminder.
// ============================================================================
import { NextResponse } from 'next/server';

function toDTLocalUTC(timeHHMM: string) {
  // why: naive UTC time; client builds link with local expectation; keep simple
  const [hh, mm] = timeHHMM.split(':').map(n => parseInt(n || '0', 10));
  const d = new Date(); d.setUTCHours(hh, mm, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const time = searchParams.get('time') || '20:00';
  const stamp = toDTLocalUTC(time);
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DueCare//KickReminder//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:kick-${Date.now()}@duecare`,`DTSTAMP:${stamp}`,`DTSTART:${stamp}`,`DTEND:${stamp}`,
    'SUMMARY:Fetal kick count','DESCRIPTION:Take 1 hour to count fetal movements.',
    'RRULE:FREQ=DAILY',
    'END:VEVENT','END:VCALENDAR',
  ].join('\r\n');
  return new NextResponse(lines, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename=kick_reminder.ics',
    },
  });
}
