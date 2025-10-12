// apps/clinician-app/app/api/appointments/[id]/ics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppointment } from '../../../_store';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const a = getAppointment(params.id);
  if (!a) return new NextResponse('Not found', { status: 404 });

  const uid = `${a.id}@ambulant.plus`;
  const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ambulant+//Televisit//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(a.startISO)}`,
    `DTEND:${dt(a.endISO)}`,
    `SUMMARY:Televisit with ${a.clinicianId}`,
    `DESCRIPTION:Televisit appointment (${a.status}).`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${a.id}.ics"`,
      'access-control-allow-origin': '*',
    },
  });
}
