// apps/api-gateway/app/api/practice/today/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AppointmentLike = Record<string, any>;

function upstreamOrigin(req: NextRequest) {
  return req.nextUrl.origin.replace(/\/$/, '');
}

function upstreamHeaders(req: NextRequest) {
  const headers = new Headers();
  headers.set('accept', 'application/json');

  for (const key of [
    'authorization',
    'cookie',
    'x-role',
    'x-uid',
    'x-clinician-id',
    'x-tenant-id',
    'x-org-id',
    'x-client-id',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  return headers;
}

function asList(payload: any): AppointmentLike[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function startOf(item: AppointmentLike): string | null {
  return item.startsAt || item.start || item.startISO || item.when || null;
}

function endOf(item: AppointmentLike): string | null {
  return item.endsAt || item.end || item.endISO || null;
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

function patientNameOf(item: AppointmentLike) {
  return (
    item.patientDisplayName ||
    item.patientName ||
    item.patient?.displayName ||
    item.patient?.name ||
    item.patientId ||
    'Patient'
  );
}

function clinicianIdOf(item: AppointmentLike) {
  return (
    item.clinicianId ||
    item.clinician?.id ||
    item.mainClinician?.id ||
    'unassigned'
  );
}

function clinicianNameOf(item: AppointmentLike) {
  return (
    item.clinicianName ||
    item.clinician?.displayName ||
    item.clinician?.name ||
    item.mainClinician?.name ||
    clinicianIdOf(item)
  );
}

function departmentIdOf(item: AppointmentLike) {
  return (
    item.departmentId ||
    item.department?.id ||
    item.specialtyId ||
    'unassigned'
  );
}

function departmentNameOf(item: AppointmentLike) {
  return (
    item.departmentName ||
    item.department?.name ||
    item.specialtyName ||
    item.specialty ||
    'Unassigned'
  );
}

function modeOf(item: AppointmentLike): 'virtual' | 'in_person' {
  const raw = String(item.mode || item.visitType || item.type || '').toLowerCase();
  return raw.includes('person') || raw.includes('room') || raw.includes('ward')
    ? 'in_person'
    : 'virtual';
}

function roomIdOf(item: AppointmentLike) {
  return item.roomId || item.roomName || item.sfuRoomId || item.callRoomId || null;
}

function emptyPayload() {
  return {
    practiceName: 'Practice',
    date: new Date().toISOString().slice(0, 10),
    totalSessions: 0,
    totalVirtual: 0,
    totalInPerson: 0,
    sessions: [],
    byClinician: [],
    byDepartment: [],
  };
}

export async function GET(req: NextRequest) {
  const gateway = upstreamOrigin(req);

  try {
    const urlIn = new URL(req.url);
    const upstream = new URL('/api/appointments', gateway);

    urlIn.searchParams.forEach((value, key) => {
      upstream.searchParams.append(key, value);
    });

    const r = await fetch(upstream.toString(), {
      method: 'GET',
      headers: upstreamHeaders(req),
      cache: 'no-store',
    });

    const text = await r.text();

    if (!r.ok) {
      return new NextResponse(text, {
        status: r.status,
        headers: {
          'content-type': r.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        },
      });
    }

    const payload = text ? JSON.parse(text) : {};
    const todayItems = asList(payload).filter((item) => isToday(startOf(item)));

    const sessions = todayItems.map((item) => {
      const mode = modeOf(item);
      return {
        id: String(item.id || item.appointmentId || item.encounterId || crypto.randomUUID()),
        caseId: String(item.caseId || item.encounterId || item.id || ''),
        patientDisplayName: patientNameOf(item),
        startTime: startOf(item) || new Date().toISOString(),
        endTime: endOf(item),
        mode,
        departmentName: departmentNameOf(item),
        mainClinician: {
          id: clinicianIdOf(item),
          name: clinicianNameOf(item),
        },
        observers: Array.isArray(item.observers) ? item.observers : [],
        roomId: roomIdOf(item),
      };
    });

    const byClinicianMap = new Map();
    const byDepartmentMap = new Map();

    for (const session of sessions) {
      const clinicianId = session.mainClinician.id;
      const clinicianName = session.mainClinician.name;
      const existingClinician =
        byClinicianMap.get(clinicianId) ||
        { clinicianId, clinicianName, totalToday: 0, virtual: 0, inPerson: 0 };

      existingClinician.totalToday += 1;
      if (session.mode === 'virtual') existingClinician.virtual += 1;
      else existingClinician.inPerson += 1;
      byClinicianMap.set(clinicianId, existingClinician);

      const departmentId = session.departmentName || 'Unassigned';
      const existingDepartment =
        byDepartmentMap.get(departmentId) ||
        { departmentId, name: session.departmentName || 'Unassigned', totalToday: 0 };

      existingDepartment.totalToday += 1;
      byDepartmentMap.set(departmentId, existingDepartment);
    }

    const totalVirtual = sessions.filter((s) => s.mode === 'virtual').length;
    const totalInPerson = sessions.length - totalVirtual;

    return NextResponse.json(
      {
        practiceName: 'Practice',
        date: new Date().toISOString().slice(0, 10),
        totalSessions: sessions.length,
        totalVirtual,
        totalInPerson,
        sessions,
        byClinician: Array.from(byClinicianMap.values()),
        byDepartment: Array.from(byDepartmentMap.values()),
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'practice_today_upstream_failed', detail: String(e?.message || e) },
      { status: 502 }
    );
  }
}
