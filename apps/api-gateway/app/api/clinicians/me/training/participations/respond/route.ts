import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 240): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  const identity =
    await resolveAuthenticatedClinician(request);

  if (!identity.ok) {
    return identity.response;
  }

  try {
    const body =
      await request.json().catch(
        () => ({} as any),
      );
    const assignmentId =
      clean(body?.assignmentId, 240);
    const action =
      String(body?.action || '')
        .trim()
        .toLowerCase();

    if (!assignmentId) {
      return json(
        {
          ok: false,
          error: 'assignmentId_required',
        },
        400,
      );
    }

    if (!['accept', 'decline'].includes(action)) {
      return json(
        {
          ok: false,
          error: 'action_must_be_accept_or_decline',
        },
        400,
      );
    }

    const db: any = prisma;
    const clinician: any = identity.clinician;
    const clinicianId = String(clinician.id);
    const principalKey = `clinician:${clinicianId}`;

    const [assignment, onboarding] = await Promise.all([
      db.clinicianTrainingParticipantAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          trainingSlot: true,
        },
      }),
      db.clinicianOnboarding.findFirst({
        where: { clinicianId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!assignment) {
      return json(
        {
          ok: false,
          error: 'training_assignment_not_found',
        },
        404,
      );
    }

    if (
      assignment.principalType !== 'clinician' ||
      String(assignment.principalId || '') !== clinicianId ||
      String(assignment.principalKey || '') !== principalKey
    ) {
      return json(
        {
          ok: false,
          error: 'training_assignment_identity_mismatch',
        },
        403,
      );
    }

    const slot = assignment.trainingSlot;
    const now = new Date();

    if (!slot) {
      return json(
        {
          ok: false,
          error: 'training_slot_not_found',
        },
        404,
      );
    }

    if (
      String(slot.status || '').toLowerCase() === 'cancelled' ||
      slot.cancelledAt ||
      new Date(slot.endsAt).getTime() <= now.getTime()
    ) {
      return json(
        {
          ok: false,
          error: 'training_slot_unavailable',
        },
        409,
      );
    }

    const currentStatus =
      String(assignment.status || '')
        .trim()
        .toLowerCase();

    if (
      assignment.revokedAt ||
      (assignment.expiresAt &&
        new Date(assignment.expiresAt).getTime() <= now.getTime()) ||
      ['revoked', 'expired', 'declined'].includes(currentStatus)
    ) {
      return json(
        {
          ok: false,
          error: 'training_assignment_inactive',
        },
        409,
      );
    }

    const metadata =
      assignment.metadata &&
      typeof assignment.metadata === 'object'
        ? assignment.metadata
        : {};
    const trainingCompleted =
      clinician.trainingCompleted === true ||
      String(onboarding?.status || '')
        .trim()
        .toLowerCase() === 'training_completed';
    const mandatoryQualification =
      metadata?.qualificationTraining === true ||
      Boolean(
        !trainingCompleted &&
        onboarding?.trainingSlotId &&
        String(onboarding.trainingSlotId) ===
          String(assignment.trainingSlotId),
      );

    if (action === 'accept') {
      if (currentStatus === 'accepted') {
        return json({
          ok: true,
          participation: {
            assignmentId,
            trainingSlotId:
              String(assignment.trainingSlotId),
            status: 'accepted',
            acceptedAt:
              assignment.acceptedAt?.toISOString?.() ||
              null,
            mandatoryQualification,
          },
        });
      }

      if (currentStatus === 'assigned') {
        return json({
          ok: true,
          participation: {
            assignmentId,
            trainingSlotId:
              String(assignment.trainingSlotId),
            status: 'assigned',
            acceptanceRequired: false,
            mandatoryQualification,
          },
        });
      }

      if (currentStatus !== 'invited') {
        return json(
          {
            ok: false,
            error: 'training_assignment_cannot_be_accepted',
          },
          409,
        );
      }

      const updated =
        await db.clinicianTrainingParticipantAssignment.update({
          where: { id: assignmentId },
          data: {
            status: 'accepted',
            acceptedAt: now,
            revokedAt: null,
          },
        });

      return json({
        ok: true,
        participation: {
          assignmentId: String(updated.id),
          trainingSlotId:
            String(updated.trainingSlotId),
          status: 'accepted',
          acceptedAt:
            updated.acceptedAt?.toISOString?.() ||
            now.toISOString(),
          mandatoryQualification,
        },
      });
    }

    if (mandatoryQualification) {
      return json(
        {
          ok: false,
          error: 'mandatory_training_assignment_cannot_be_declined',
        },
        409,
      );
    }

    if (currentStatus !== 'invited') {
      return json(
        {
          ok: false,
          error: 'only_pending_training_invitations_can_be_declined',
        },
        409,
      );
    }

    await db.$transaction(async (tx: any) => {
      await tx.clinicianTrainingAdmission.updateMany({
        where: {
          assignmentId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.clinicianTrainingParticipantAssignment.update({
        where: { id: assignmentId },
        data: {
          status: 'revoked',
          revokedAt: now,
          metadata: {
            ...metadata,
            declinedAt: now.toISOString(),
            declinedBy: 'clinician',
          },
        },
      });

      await tx.$executeRaw`
        UPDATE "ClinicianTrainingSlot"
        SET
          "usedCount" = GREATEST(0, "usedCount" - 1),
          "updatedAt" = NOW()
        WHERE "id" = ${String(assignment.trainingSlotId)}
      `;
    });

    return json({
      ok: true,
      participation: {
        assignmentId,
        trainingSlotId:
          String(assignment.trainingSlotId),
        status: 'revoked',
        declinedAt: now.toISOString(),
        mandatoryQualification: false,
      },
    });
  } catch (error: any) {
    console.error(
      '[clinician-training-participation-response] error',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'training_participation_response_failed',
      },
      500,
    );
  }
}
