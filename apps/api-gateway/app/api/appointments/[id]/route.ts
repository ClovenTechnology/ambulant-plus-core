// apps/api-gateway/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { updateAppointment } from '@/src/store/appointments';
import { bookingStateForAppointment } from '@/src/appointments/booking-reservation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    'cache-control': 'no-store',
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function patientDisplay(profile: any, fallback: unknown) {
  return clean(profile?.name) || clean(profile?.displayName) || clean(profile?.fullName) || clean(fallback) || 'Patient';
}

function clinicianDisplay(profile: any, fallback: unknown) {
  return clean(profile?.displayName) || clean(profile?.name) || clean(profile?.email) || clean(fallback) || 'Clinician';
}

function shape(row: any, visit: any, clinician: any, patient: any) {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  const roomId = row.roomId ?? visit?.roomId ?? meta.roomId ?? null;

  const patientName =
    clean(meta.patientDisplayName) ||
    patientDisplay(patient, row.subjectPatientId || row.patientId);

  const clinicianName =
    clean(meta.clinicianDisplayName) ||
    clinicianDisplay(clinician, row.clinicianId);

  return {
    ...row,
    appointmentId: row.id,
    when: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
    startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
    endsAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : row.endsAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    visitId: visit?.id ?? meta.visitId ?? null,
    televisitId: visit?.id ?? meta.televisitId ?? null,
    roomId,
    patientJoinUrl: meta.patientJoinUrl ?? null,
    clinicianJoinUrl: meta.clinicianJoinUrl ?? null,
    patientParticipantId: meta.patientParticipantId ?? (row.patientId ? 'pat-' + row.patientId : null),
    clinicianParticipantId: meta.clinicianParticipantId ?? (row.clinicianId ? 'clin-' + row.clinicianId : null),

    patientName,
    patientDisplayName: patientName,
    patientAvatarUrl: patient?.photoUrl ?? meta.patientAvatarUrl ?? null,
    patientGender: patient?.gender ?? null,
    patientDob: patient?.dob instanceof Date ? patient.dob.toISOString() : patient?.dob ?? null,

    clinicianName,
    clinicianDisplayName: clinicianName,
    clinicianSpecialty: clinician?.specialty ?? meta.clinicianSpecialty ?? null,
    clinicianAvatarUrl: clinician?.photoUrl ?? meta.clinicianAvatarUrl ?? null,
    clinicianGender: clinician?.gender ?? null,
    clinicianLocation:
      clean(clinician?.city) ||
      clean(clinician?.practiceName) ||
      clean(clinician?.country) ||
      null,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = clean(params.id);
    let row = await prisma.appointment.findUnique({ where: { id } });

    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    const booking = await bookingStateForAppointment(row.id);
    row = (await prisma.appointment.findUnique({ where: { id } })) || row;

    const [visit, clinician, patient] = await Promise.all([
      prisma.televisit.findFirst({
        where: { appointmentId: row.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clinicianProfile.findUnique({
        where: { id: row.clinicianId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          specialty: true,
          gender: true,
          photoUrl: true,
          city: true,
          country: true,
          practiceName: true,
          email: true,
        },
      }).catch(() => null),
      prisma.patientProfile.findFirst({
        where: {
          OR: [
            { id: row.subjectPatientId || row.patientId },
            { userId: row.subjectPatientId || row.patientId },
            { id: row.patientId },
            { userId: row.patientId },
          ],
        },
        select: {
          id: true,
          userId: true,
          name: true,
          gender: true,
          dob: true,
          photoUrl: true,
          contactEmail: true,
          phone: true,
          city: true,
        },
      }).catch(() => null),
    ]);

    const appointment = {
      ...shape(row, visit, clinician, patient),
      booking,
    };
    return json({ ok: true, appointment, ...appointment, booking });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'appointment_load_failed' }, 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string }}) {
  const id = clean(params.id);

  try {
    const body = await req.json();
    const out = await updateAppointment(id, {
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      meta: body.meta,
    });

    return json(out);
  } catch (e: any) {
    if (e?.code === 'patient_conflict' || e?.message === 'patient_conflict') {
      return json({ error: 'patient_conflict' }, 409);
    }

    if (e?.code === 'clinician_conflict' || e?.message === 'clinician_conflict') {
      return json({ error: 'clinician_conflict' }, 409);
    }

    if (e?.message === 'not_found') {
      return json({ error: 'not_found' }, 404);
    }

    return json({ error: 'bad_request', detail: e?.message }, 400);
  }
}
