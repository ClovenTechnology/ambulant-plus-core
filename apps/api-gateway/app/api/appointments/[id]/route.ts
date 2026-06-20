// apps/api-gateway/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { updateAppointment } from '@/src/store/appointments';

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

function shape(row: any, visit: any) {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};

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
    roomId: row.roomId ?? visit?.roomId ?? meta.roomId ?? null,
    patientJoinUrl: meta.patientJoinUrl ?? null,
    clinicianJoinUrl: meta.clinicianJoinUrl ?? null,
    patientName: meta.patientDisplayName ?? row.patientId ?? 'Patient',
    clinicianName: meta.clinicianDisplayName ?? row.clinicianId ?? 'Clinician',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = clean(params.id);
    const row = await prisma.appointment.findUnique({ where: { id } });

    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    const visit = await prisma.televisit.findFirst({
      where: { appointmentId: row.id },
      orderBy: { createdAt: 'desc' },
    });

    return json({ ok: true, appointment: shape(row, visit), ...shape(row, visit) });
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
