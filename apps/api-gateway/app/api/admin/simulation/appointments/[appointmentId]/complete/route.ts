import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { verifyAdminRequest } from '../../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

function asRecord(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanStr(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function canCompleteSimulation(adminCheck: any) {
  if (adminCheck?.ok === false) return false;

  const role = String(
    adminCheck?.role ??
      adminCheck?.user?.role ??
      adminCheck?.claims?.role ??
      '',
  ).toLowerCase();

  if (!role) return true;

  return [
    'admin',
    'super_admin',
    'owner',
    'operations',
    'ops',
    'training',
    'training_lead',
  ].some((allowed) => role.includes(allowed));
}

function actorId(adminCheck: any, req: NextRequest) {
  return cleanStr(
    adminCheck?.uid ??
      adminCheck?.userId ??
      adminCheck?.user?.id ??
      req.headers.get('x-uid') ??
      'admin-dashboard',
    120,
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { appointmentId: string } },
) {
  try {
    const adminCheck = await verifyAdminRequest(req as any);

    if ((adminCheck as any)?.ok === false) {
      return (adminCheck as any).response;
    }

    if (!canCompleteSimulation(adminCheck)) {
      return json({ ok: false, error: 'admin_required' }, 403);
    }

    const appointmentId = cleanStr(params.appointmentId, 160);
    if (!appointmentId) {
      return json({ ok: false, error: 'appointmentId_required' }, 400);
    }

    const body = await req.json().catch(() => ({} as any));
    const clinicianId = cleanStr(body?.clinicianId, 120);
    const note = cleanStr(body?.note, 500);
    const now = new Date().toISOString();
    const adminUid = actorId(adminCheck, req);

    const existing = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...(clinicianId ? { clinicianId } : {}),
      },
      select: {
        id: true,
        clinicianId: true,
        bookingSource: true,
        meta: true,
      },
    });

    if (!existing) {
      return json({ ok: false, error: 'simulation_appointment_not_found' }, 404);
    }

    const meta = asRecord(existing.meta);

    if (existing.bookingSource !== 'admin_simulation' && meta.simulation !== true) {
      return json({ ok: false, error: 'not_a_simulation_appointment' }, 409);
    }

    const checklist = asRecord(meta.simulationChecklist);

    const nextMeta = {
      ...meta,
      completedAt: meta.completedAt || now,
      simulationCompletedAt: meta.simulationCompletedAt || now,
      completedByAdminId: meta.completedByAdminId || adminUid,
      completionNote: note || meta.completionNote || null,
      simulationChecklist: {
        ...checklist,
        completed: true,
        adminMarkedComplete: true,
        completedAt: checklist.completedAt || now,
        completedByAdminId: checklist.completedByAdminId || adminUid,
        note: note || checklist.note || null,
      },
    };

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        meta: nextMeta,
      },
      select: {
        id: true,
        clinicianId: true,
        encounterId: true,
        caseId: true,
        roomId: true,
        reason: true,
        startsAt: true,
        endsAt: true,
        status: true,
        paymentStatus: true,
        bookingSource: true,
        meta: true,
        updatedAt: true,
      },
    });

    return json({
      ok: true,
      appointmentId: updated.id,
      clinicianId: updated.clinicianId,
      completed: true,
      completedAt: nextMeta.simulationCompletedAt,
      completedByAdminId: nextMeta.completedByAdminId,
      appointment: updated,
    });
  } catch (err: any) {
    console.error('[api-gateway][admin][simulation][complete] error', err);

    return json(
      {
        ok: false,
        error: String(err?.message || 'simulation_complete_failed'),
      },
      500,
    );
  }
}
