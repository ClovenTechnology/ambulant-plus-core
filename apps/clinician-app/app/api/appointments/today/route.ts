// apps/clinician-app/app/api/appointments/today/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  ensureClinicianSelfOrPrivileged,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';

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

function asList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function startsAtOf(item: any): string | null {
  return item?.startsAt || item?.start || item?.startISO || item?.when || null;
}

function isToday(value: string | null) {
  if (!value) return false;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function normaliseAppointment(a: any, clinicianId: string) {
  const roomId = a.roomId || a.room_id || a.roomName || ('room-' + a.id);
  const start = a.startsAt || a.start || a.startISO || a.when;
  const end = a.endsAt || a.end || a.endISO;

  return {
    ...a,
    id: String(a.id || a.appointmentId),
    start,
    end,
    startsAt: start,
    endsAt: end,
    reason: a.reason || a.title || 'Televisit consultation',
    visitType: 'Video',
    status: a.status || 'confirmed',
    roomName: roomId,
    roomId,
    visitId: a.visitId || a.televisitId || a.televisit?.id || null,
    encounterId: a.encounterId || a.encounter_id || null,
    patient: {
      id: a.patientId || a.patient_id || a.subjectPatientId || 'patient',
      name: a.patientName || a.patient?.name || a.meta?.patientDisplayName || 'Patient',
      avatarUrl: a.patient?.avatarUrl,
    },
    clinician: {
      id: a.clinicianId || a.clinician_id || clinicianId,
      name: a.clinicianName || a.clinician?.name || 'Clinician',
    },
    patientJoinUrl: a.patientJoinUrl || a.meta?.patientJoinUrl || null,
    clinicianJoinUrl: a.clinicianJoinUrl || a.meta?.clinicianJoinUrl || null,
    patientParticipantId:
      a.patientParticipantId ||
      a.meta?.patientParticipantId ||
      (a.patientId ? 'pat-' + a.patientId : null),
    clinicianParticipantId:
      a.clinicianParticipantId ||
      a.meta?.clinicianParticipantId ||
      ((a.clinicianId || clinicianId) ? 'clin-' + (a.clinicianId || clinicianId) : null),
  };
}

export async function GET(req: NextRequest) {
  const gw = gatewayBase();
  if (!gw) return json({ ok: false, error: 'api_gateway_url_missing', appointments: [] }, 500);

  const auth = await requireClinicianAuth(req, {
    allowAdmin: true,
    allowAdminStaff: true,
  });

  if (!auth.ok) return authErrorResponse(auth);

  try {
    const urlIn = new URL(req.url);
    const requestedClinicianId = String(urlIn.searchParams.get('clinicianId') || '').trim();

    const denied = ensureClinicianSelfOrPrivileged(auth, requestedClinicianId);
    if (denied) return authErrorResponse(denied);

    const clinicianId =
      auth.role === 'clinician'
        ? auth.clinicianId
        : requestedClinicianId || auth.clinicianId;

    if (!clinicianId) {
      return json({ ok: false, error: 'missing_clinician_identity', appointments: [] }, 401);
    }

    const upstream = new URL('/api/appointments', gw);
    upstream.searchParams.set('clinicianId', clinicianId);
    upstream.searchParams.set('excludeSimulation', '1');

    const r = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-role': auth.role,
        'x-uid': auth.session?.sub || auth.clinician?.userId || clinicianId,
        'x-clinician-id': clinicianId,
      },
      cache: 'no-store',
    });

    const payload = await r.json().catch(() => ({}));

    if (!r.ok || payload?.ok === false) {
      return json(
        {
          ok: false,
          error: payload?.error || 'appointments_gateway_failed',
          appointments: [],
        },
        r.status || 502,
      );
    }

    const today = asList(payload)
      .filter((item) => isToday(startsAtOf(item)))
      .map((item) => normaliseAppointment(item, clinicianId))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return json({
      ok: true,
      appointments: today,
      items: today,
      total: today.length,
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'appointments_today_failed',
        appointments: [],
      },
      500,
    );
  }
}
