// apps/clinician-app/app/api/appointments/[id]/ics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).replace(/\/+$/, '');
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function stamp(value: unknown) {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function trustedGatewayHeaders(req: NextRequest, trustedIdentity: string) {
  const headers = new Headers({
    accept: 'application/json',
    'x-ambulant-identity': trustedIdentity,
  });

  const authorization = req.headers.get('authorization');
  const requestId = req.headers.get('x-request-id');
  const correlationId = req.headers.get('x-correlation-id');
  if (authorization) headers.set('authorization', authorization);
  if (requestId) headers.set('x-request-id', requestId);
  if (correlationId) headers.set('x-correlation-id', correlationId);

  return headers;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });
  if (!auth.ok) return authErrorResponse(auth);

  const id = clean(params.id, 240);
  if (!id) return json({ ok: false, error: 'appointment_id_required' }, 400);

  const gw = gatewayBase();
  if (!gw) return json({ ok: false, error: 'api_gateway_url_missing' }, 500);

  let trustedIdentity: string;
  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return json(
      { ok: false, error: String(error?.message || 'identity_bridge_failed') },
      Number(error?.status || 500),
    );
  }

  try {
    const upstream = new URL('/api/appointments/' + encodeURIComponent(id), gw);
    const response = await fetch(upstream.toString(), {
      method: 'GET',
      headers: trustedGatewayHeaders(req, trustedIdentity),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok || payload?.ok === false) {
      return json(
        { ok: false, error: payload?.error || 'appointment_not_found' },
        response.status || 502,
      );
    }

    const appointment = payload?.appointment || payload;
    const appointmentClinicianId = clean(
      appointment?.clinicianId ||
        appointment?.clinician_id ||
        appointment?.clinician?.id,
      240,
    );

    if (
      auth.role === 'clinician' &&
      (!appointmentClinicianId || appointmentClinicianId !== auth.clinicianId)
    ) {
      return json({ ok: false, error: 'appointment_access_denied' }, 403);
    }

    const startsAt = stamp(appointment?.startsAt || appointment?.start || appointment?.startISO);
    const endsAt = stamp(appointment?.endsAt || appointment?.end || appointment?.endISO);
    if (!startsAt || !endsAt) {
      return json({ ok: false, error: 'appointment_window_incomplete' }, 409);
    }

    const patientName = clean(
      appointment?.patientName ||
        appointment?.patientDisplayName ||
        appointment?.patient?.name ||
        'Patient',
    );
    const reason = clean(appointment?.reason || appointment?.title || 'Televisit consultation');
    const joinUrl = clean(appointment?.clinicianJoinUrl || appointment?.joinUrl || '', 2000);
    const status = clean(appointment?.status || 'scheduled', 120);

    const description = [
      `Ambulant+ Televisit (${status})`,
      reason ? `Reason: ${reason}` : '',
      joinUrl ? `Join: ${joinUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ambulant+//Clinician Appointment//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${esc(id)}@ambulantplus.co.za`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${startsAt}`,
      `DTEND:${endsAt}`,
      `SUMMARY:${esc(`Ambulant+ Televisit — ${patientName}`)}`,
      `DESCRIPTION:${esc(description)}`,
      'LOCATION:Ambulant+ Contactless Medicine',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `attachment; filename="ambulant-appointment-${id}.ics"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || 'ics_generation_failed' },
      502,
    );
  }
}
