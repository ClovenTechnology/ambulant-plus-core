// ============================================================================
// apps/patient-app/app/api/ics/antenatal/route.ts
// ICS schedule with optional multi-line LOCATION and GEO.
// ============================================================================
import { NextResponse } from 'next/server';
import { buildVisitSchedule } from '@/src/analytics/antenatal';

function toDT(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T090000Z`;
}
function foldICS(value: string) {
  // Minimal fold: replace real newlines with escaped \n for ICS
  return value.replace(/\r?\n/g, '\\n');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const edd = searchParams.get('edd');
  if (!edd) return new NextResponse('Missing edd', { status: 400 });

  const location = (searchParams.get('location') || 'Ambulant+ Virtual Clinic').slice(0, 200);
  const telehealth = (searchParams.get('telehealth') || '').slice(0, 500);
  const addr = (searchParams.get('addr') || '').slice(0, 800); // optional multi-line input from UI
  const geoLat = searchParams.get('geoLat');
  const geoLon = searchParams.get('geoLon');

  const schedule = buildVisitSchedule(edd);
  const lines: string[] = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DueCare//Antenatal//EN','CALSCALE:GREGORIAN'];

  for (const v of schedule) {
    const addrBlock = addr ? `\\n${foldICS(addr)}` : '';
    const geoLine = (geoLat && geoLon) ? `GEO:${parseFloat(geoLat)};${parseFloat(geoLon)}` : null;
    lines.push(
      'BEGIN:VEVENT',
      `UID:anc-${v.date}@duecare`,
      `DTSTAMP:${toDT(v.date)}`,
      `DTSTART:${toDT(v.date)}`,
      `DTEND:${toDT(v.date)}`,
      `SUMMARY:${v.label}`,
      `DESCRIPTION:${v.purpose}${telehealth ? `\\nTelehealth: ${telehealth}` : ''}`,
      `LOCATION:${foldICS(location)}${addrBlock}`,
      ...(telehealth ? [`URL:${telehealth}`] : []),
      ...(geoLine ? [geoLine] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename=antenatal_schedule.ics',
    },
  });
}