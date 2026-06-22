// apps/patient-app/app/api/appointments/[id]/ics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function stamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = String(params.id || '').trim();

  try {
    const local = new URL('/api/appointments/' + encodeURIComponent(id), req.url);
    const r = await fetch(local.toString(), {
      headers: {
        cookie: req.headers.get('cookie') || '',
        authorization: req.headers.get('authorization') || '',
        'x-role': req.headers.get('x-role') || 'patient',
        'x-uid': req.headers.get('x-uid') || '',
        'x-org-id': req.headers.get('x-org-id') || '',
      },
      cache: 'no-store',
    });

    const raw = await r.json().catch(() => ({} as any));
    const a = raw?.appointment || raw;

    if (!r.ok || !a?.id) {
      return NextResponse.json({ ok: false, error: 'appointment_not_found' }, { status: 404 });
    }

    const summary = esc(a.reason || 'Ambulant+ Televisit');
    const clinician = esc(a.clinicianName || a.clinicianDisplayName || a.clinicianId || '');
    const description = esc(
      [
        'Ambulant+ appointment',
        clinician ? 'Clinician: ' + clinician : '',
        a.patientJoinUrl ? 'Join: ' + a.patientJoinUrl : '',
      ].filter(Boolean).join('\n'),
    );

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ambulant+//Appointment//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + esc(a.id) + '@ambulantplus.co.za',
      'DTSTAMP:' + stamp(new Date().toISOString()),
      'DTSTART:' + stamp(a.startsAt),
      'DTEND:' + stamp(a.endsAt),
      'SUMMARY:' + summary,
      'DESCRIPTION:' + description,
      'LOCATION:' + esc(a.location || 'Ambulant+ Televisit'),
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'attachment; filename="ambulant-appointment-' + id + '.ics"',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'ics_generation_failed' },
      { status: 500 },
    );
  }
}
