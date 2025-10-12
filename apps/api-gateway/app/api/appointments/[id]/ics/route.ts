// apps/api-gateway/app/api/appointments/[id]/ics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

function dt(s: string) {
  return new Date(s)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!a) return new NextResponse('Not found', { status: 404 });

  const starts = a.startsAt ?? new Date();
  const ends = a.endsAt ?? new Date(starts.getTime() + 30 * 60 * 1000);

  const uid = `${a.id}@ambulant.plus`;
  const origin = req.nextUrl.origin;
  const icsHref = `${origin}/api/appointments/${a.id}/ics`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ambulant+//Televisit//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(starts.toISOString())}`,
    `DTEND:${dt(ends.toISOString())}`,
    `SUMMARY:Televisit (${a.clinicianId ?? 'Clinician'})`,
    `DESCRIPTION:Televisit with ${a.clinicianId ?? ''} (${a.status}).`,
    `URL:${icsHref}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${a.id}.ics"`,
      'access-control-allow-origin': '*',
      'content-location': icsHref
    }
  });
}
