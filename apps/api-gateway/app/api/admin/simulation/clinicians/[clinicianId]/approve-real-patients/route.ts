import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { verifyAdminRequest } from '../../../../utils/auth';
import {
  resolveClinicianOnboardingEntitlements,
} from '@/src/clinicians/onboarding/entitlements';

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

function sessionNumber(meta: any, reason?: string | null): number | null {
  const m = asRecord(meta);

  const direct = Number(m.sessionNumber);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 99) {
    return Math.trunc(direct);
  }

  const text = String(reason || m.reason || '').trim();
  const match =
    text.match(/(?:session|consultation)\s+(\d+)(?:\s*(?:of|\/)\s*3)?/i) ||
    text.match(/\b(\d+)\s*\/\s*3\b/);

  const fromReason = match ? Number(match[1]) : NaN;
  return Number.isFinite(fromReason) && fromReason >= 1 && fromReason <= 99
    ? Math.trunc(fromReason)
    : null;
}

function simulationCompleted(meta: any): boolean {
  const m = asRecord(meta);
  const checklist = asRecord(m.simulationChecklist);

  return Boolean(
    m.completedAt ||
      m.simulationCompletedAt ||
      checklist.completedAt ||
      checklist.completed === true ||
      checklist.adminMarkedComplete === true,
  );
}

function canApproveRealPatients(adminCheck: any) {
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
  { params }: { params: { clinicianId: string } },
) {
  try {
    const adminCheck = await verifyAdminRequest(req as any);

    if ((adminCheck as any)?.ok === false) {
      return (adminCheck as any).response;
    }

    if (!canApproveRealPatients(adminCheck)) {
      return json({ ok: false, error: 'admin_required' }, 403);
    }

    const clinicianId = cleanStr(params.clinicianId, 160);

    if (!clinicianId) {
      return json({ ok: false, error: 'clinicianId_required' }, 400);
    }

    const body = await req.json().catch(() => ({} as any));
    const note = cleanStr(body?.note, 700);
    const now = new Date().toISOString();
    const adminUid = actorId(adminCheck, req);

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
        trainingCompleted: true,
        disabled: true,
        archived: true,
        meta: true,
      },
    });

    if (!clinician) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    if (clinician.trainingCompleted !== true) {
      return json(
        {
          ok: false,
          error: 'training_not_completed',
          message: 'Clinician training must be completed before real-patient approval.',
        },
        409,
      );
    }

    const onboarding =
      await prisma.clinicianOnboarding
        .findUnique({
          where: {
            clinicianId,
          },
        });

    const entitlements =
      await resolveClinicianOnboardingEntitlements(
        prisma,
        clinicianId,
        onboarding,
      );

    if (
      !entitlements.practiceActivation
    ) {
      return json(
        {
          ok: false,
          error:
            'commercial_practice_activation_not_granted',
          message:
            'The effective Admin-configured onboarding pathway does not grant practice activation.',
          entitlements: {
            pathwayKey:
              entitlements.pathwayKey,
            privileges:
              entitlements.privileges,
            paymentState:
              entitlements.paymentState,
          },
        },
        409,
      );
    }

    const simulationRows = await prisma.appointment.findMany({
      where: {
        clinicianId,
        bookingSource: 'admin_simulation',
      },
      select: {
        id: true,
        reason: true,
        meta: true,
      },
    });

    const completedNumbers = new Set<number>();
    let completedRows = 0;

    for (const row of simulationRows) {
      const meta = asRecord(row.meta);
      if (!simulationCompleted(meta)) continue;

      completedRows += 1;

      const n = sessionNumber(meta, row.reason);
      if (n) completedNumbers.add(n);
    }

    const completedCount = Math.max(completedNumbers.size, completedRows);

    if (completedCount < 3) {
      return json(
        {
          ok: false,
          error: 'simulation_incomplete',
          requiredSessions: 3,
          completedCount,
          message: 'Three completed supervised simulation sessions are required before real-patient approval.',
        },
        409,
      );
    }

    const meta = asRecord(clinician.meta);
    const realPatientApproval = asRecord(meta.realPatientApproval);

    const nextMeta = {
      ...meta,
      simulationCompleted: true,
      simulationCompletedAt:
        typeof meta.simulationCompletedAt === 'string' ? meta.simulationCompletedAt : now,
      adminFinalApproved: true,
      realPatientApprovedAt:
        typeof meta.realPatientApprovedAt === 'string' ? meta.realPatientApprovedAt : now,
      realPatientApproval: {
        ...realPatientApproval,
        approved: true,
        approvedAt:
          typeof realPatientApproval.approvedAt === 'string'
            ? realPatientApproval.approvedAt
            : now,
        approvedByAdminId: realPatientApproval.approvedByAdminId || adminUid,
        note: note || realPatientApproval.note || null,
      },
    };

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        status: 'active',
        disabled: false,
        archived: false,
        trainingCompleted: true,
        meta: nextMeta,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
        trainingCompleted: true,
        disabled: true,
        archived: true,
        meta: true,
        updatedAt: true,
      },
    });

    return json({
      ok: true,
      clinicianId: updated.id,
      visibleToPatients:
        String(updated.status || '').toLowerCase() === 'active' &&
        updated.disabled !== true &&
        updated.archived !== true,
      realPatientApprovedAt: nextMeta.realPatientApproval.approvedAt,
      requiredSessions: 3,
      completedCount,
      entitlements: {
        pathwayKey:
          entitlements.pathwayKey,
        privileges:
          entitlements.privileges,
        paymentState:
          entitlements.paymentState,
      },
      clinician: updated,
    });
  } catch (err: any) {
    console.error('[api-gateway][admin][simulation][approve-real-patients] error', err);

    return json(
      {
        ok: false,
        error: String(err?.message || 'approve_real_patients_failed'),
      },
      500,
    );
  }
}
