import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';
import {
  deliverClinicianTrainingNotification,
} from '@/src/clinicians/onboarding/training-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 240): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminRequest(request);
    if (admin.ok === false) {
      return admin.response;
    }

    const body = await request.json().catch(() => ({} as any));
    const clinicianId = cleanStr(body?.clinicianId, 120);
    const onboardingId = cleanStr(body?.onboardingId, 120);
    const trainingSlotId = cleanStr(body?.trainingSlotId, 120);

    if (!clinicianId || !onboardingId || !trainingSlotId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'clinicianId, onboardingId, trainingSlotId required',
        },
        { status: 400 },
      );
    }

    const db: any = prisma;

    const [clinician, onboarding, slot] = await Promise.all([
      db.clinicianProfile.findUnique({
        where: { id: clinicianId },
      }),
      db.clinicianOnboarding.findUnique({
        where: { id: onboardingId },
      }),
      db.clinicianTrainingSlot.findUnique({
        where: { id: trainingSlotId },
      }),
    ]);

    if (!clinician) {
      return NextResponse.json(
        { ok: false, error: 'clinician_not_found' },
        { status: 404 },
      );
    }

    if (
      !onboarding ||
      String(onboarding.clinicianId) !== clinicianId
    ) {
      return NextResponse.json(
        { ok: false, error: 'onboarding_not_found' },
        { status: 404 },
      );
    }

    if (!slot) {
      return NextResponse.json(
        { ok: false, error: 'training_slot_not_found' },
        { status: 404 },
      );
    }

    const trainingCompleted =
      clinician.trainingCompleted === true ||
      String(onboarding.status || '')
        .trim()
        .toLowerCase() === 'training_completed';

    const mandatoryQualification =
      String(onboarding.trainingSlotId || '') ===
        trainingSlotId;

    if (mandatoryQualification && trainingCompleted) {
      return NextResponse.json(
        {
          ok: false,
          error: 'completed_training_cannot_be_cancelled',
        },
        { status: 409 },
      );
    }

    const principalKey = `clinician:${clinicianId}`;
    const now = new Date();

    const assignments =
      await db.clinicianTrainingParticipantAssignment.findMany({
        where: {
          trainingSlotId,
          principalType: 'clinician',
          OR: [
            { principalId: clinicianId },
            { principalKey },
          ],
          status: {
            in: ['assigned', 'accepted', 'invited'],
          },
          revokedAt: null,
        },
        select: {
          id: true,
        },
      });

    const assignmentIds = assignments.map(
      (assignment: any) => String(assignment.id),
    );

    const legacyMandatoryBooking =
      mandatoryQualification && !trainingCompleted;

    if (!assignmentIds.length && !legacyMandatoryBooking) {
      return NextResponse.json(
        {
          ok: false,
          error: 'training_assignment_not_found',
        },
        { status: 404 },
      );
    }

    const result = await db.$transaction(async (tx: any) => {
      if (assignmentIds.length) {
        await tx.clinicianTrainingAdmission.updateMany({
          where: {
            assignmentId: { in: assignmentIds },
            revokedAt: null,
          },
          data: { revokedAt: now },
        });

        await tx.clinicianTrainingParticipantAssignment.updateMany({
          where: {
            id: { in: assignmentIds },
          },
          data: {
            status: 'revoked',
            revokedAt: now,
          },
        });
      }

      await tx.$executeRaw`
        UPDATE "ClinicianTrainingSlot"
        SET
          "usedCount" = GREATEST(0, "usedCount" - 1),
          "updatedAt" = NOW()
        WHERE "id" = ${trainingSlotId}
      `;

      let nextOnboarding = onboarding;

      if (legacyMandatoryBooking) {
        nextOnboarding = await tx.clinicianOnboarding.update({
          where: { id: onboardingId },
          data: {
            status: 'approved',
            trainingSlotId: null,
            trainingMode: null,
            trainingNotes: [
              cleanStr(onboarding.trainingNotes, 2000),
              `Training cancelled ${now.toISOString()}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        });

        await tx.clinicianProfile.update({
          where: { id: clinicianId },
          data: {
            trainingScheduledAt: null,
          },
        });
      }

      return {
        onboarding: nextOnboarding,
      };
    });

    const notification =
      await deliverClinicianTrainingNotification({
        action: 'cancelled',
        recipientEmail: clinician?.email,
        recipientUserId:
          clinician?.userId || clinician?.email || null,
        recipientName:
          clinician?.displayName ||
          clinician?.fullName ||
          clinician?.name ||
          clinician?.email ||
          'Clinician',
        trainingSlotId,
        title: slot.title,
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
        timezone: slot.timezone,
        mode: slot.mode,
        joinUrl: null,
      });

    return NextResponse.json(
      {
        ok: true,
        clinicianId,
        trainingSlotId,
        mandatoryQualification:
          legacyMandatoryBooking,
        notification,
        notificationDeliveryRequired: true,
        participation: {
          assignmentIds,
          status: 'revoked',
          revokedAt: now.toISOString(),
        },
        onboarding: {
          id: String(result.onboarding.id),
          stage: String(result.onboarding.status),
          trainingSlotId:
            result.onboarding.trainingSlotId || null,
        },
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error: any) {
    console.error(
      '[api-gateway][admin][clinicians][onboarding][cancel-training] error',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            'cancel_training_failed',
        ),
      },
      { status: 500 },
    );
  }
}
