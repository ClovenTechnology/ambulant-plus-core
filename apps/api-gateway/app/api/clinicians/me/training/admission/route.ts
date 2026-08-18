import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';
import {
  ipAddressFromRequest,
  issueTrainingAdmission,
  trainingPrincipalKey,
  TrainingAdmissionError,
} from '@/src/clinicians/onboarding/training-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

function cleanText(
  value: unknown,
  max = 320,
) {
  const text =
    String(value ?? '').trim();

  if (!text) {
    return null;
  }

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function clinicianName(
  clinician: any,
) {
  const composed = [
    cleanText(
      clinician.firstName,
      120,
    ),
    cleanText(
      clinician.lastName,
      120,
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    cleanText(
      clinician.fullName,
      240,
    ) ||
    cleanText(
      clinician.name,
      240,
    ) ||
    cleanText(
      clinician.displayName,
      240,
    ) ||
    cleanText(
      composed,
      240,
    ) ||
    cleanText(
      clinician.email,
      240,
    ) ||
    'Clinician'
  );
}

export async function POST(
  request: NextRequest,
) {
  const identity =
    await resolveAuthenticatedClinician(
      request,
    );

  if (!identity.ok) {
    return identity.response;
  }

  const db: any = prisma;
  const clinician: any =
    identity.clinician;

  try {
    const body =
      await request.json().catch(
        () => ({} as any),
      );

    const requestedRoomId =
      cleanText(
        body?.roomId ||
          body?.room ||
          body?.roomName,
        400,
      );

    const slotFromRoom =
      requestedRoomId &&
      requestedRoomId.startsWith(
        'training-slot-',
      )
        ? cleanText(
            requestedRoomId.slice(
              'training-slot-'.length,
            ),
            240,
          )
        : null;

    const requestedTrainingSlotId =
      cleanText(
        body?.trainingSlotId ||
          body?.slotId,
        240,
      ) || slotFromRoom;

    const onboarding =
      await db.clinicianOnboarding
        .findFirst({
          where: {
            clinicianId:
              String(
                clinician.id,
              ),
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    const principalKey =
      trainingPrincipalKey(
        'clinician',
        String(clinician.id),
      );
    const sessionKey = 'slot';
    const now = new Date();

    let trainingSlotId =
      requestedTrainingSlotId ||
      cleanText(
        onboarding?.trainingSlotId,
        240,
      );

    let assignment: any = null;

    if (trainingSlotId) {
      assignment =
        await db
          .clinicianTrainingParticipantAssignment
          .findUnique({
            where: {
              trainingSlotId_sessionKey_principalKey: {
                trainingSlotId,
                sessionKey,
                principalKey,
              },
            },
          });
    }

    if (
      !assignment &&
      !requestedTrainingSlotId &&
      !trainingSlotId
    ) {
      const activeAssignments =
        await db
          .clinicianTrainingParticipantAssignment
          .findMany({
            where: {
              principalType: 'clinician',
              principalId:
                String(clinician.id),
              revokedAt: null,
              status: {
                in: [
                  'assigned',
                  'accepted',
                  'invited',
                ],
              },
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
            include: {
              trainingSlot: true,
            },
            orderBy: {
              assignedAt: 'desc',
            },
            take: 20,
          });

      const usableAssignments =
        activeAssignments.filter(
          (item: any) =>
            item.trainingSlot &&
            String(
              item.trainingSlot.status ||
                '',
            ).toLowerCase() !==
              'cancelled' &&
            !item.trainingSlot.cancelledAt &&
            new Date(
              item.trainingSlot.endsAt,
            ).getTime() >
              now.getTime(),
        );

      if (usableAssignments.length === 1) {
        assignment =
          usableAssignments[0];
        trainingSlotId =
          String(
            assignment.trainingSlotId,
          );
      }
      else if (
        usableAssignments.length > 1
      ) {
        return json(
          {
            ok: false,
            error:
              'training_slot_selection_required',
          },
          409,
        );
      }
    }

    const legacyQualificationSlot =
      Boolean(
        trainingSlotId &&
        onboarding &&
        String(
          onboarding.trainingSlotId ||
            '',
        ) === String(trainingSlotId) &&
        clinician.trainingCompleted !==
          true &&
        String(
          onboarding.status || '',
        )
          .trim()
          .toLowerCase() !==
          'training_completed',
      );

    if (
      !assignment &&
      trainingSlotId &&
      legacyQualificationSlot
    ) {
      const displayName =
        clinicianName(clinician);
      const email =
        cleanText(
          clinician.email,
          320,
        );
      const specialty =
        cleanText(
          clinician.specialty ||
            clinician.speciality,
          240,
        );

      assignment =
        await db
          .clinicianTrainingParticipantAssignment
          .upsert({
            where: {
              trainingSlotId_sessionKey_principalKey: {
                trainingSlotId,
                sessionKey,
                principalKey,
              },
            },
            create: {
              trainingSlotId,
              sessionKey,
              principalType:
                'clinician',
              principalId:
                String(clinician.id),
              principalKey,
              email,
              name: displayName,
              role: 'clinician',
              permissions: [
                'training:join',
                'training:attendance:self',
              ],
              scopeSnapshot: {
                clinicianId:
                  String(
                    clinician.id,
                  ),
                specialty,
              },
              status: 'assigned',
              assignedAt:
                onboarding.trainingBookedAt ||
                onboarding.updatedAt ||
                now,
              metadata: {
                source:
                  'legacy_onboarding_booking',
                qualificationTraining: true,
                onboardingId:
                  String(
                    onboarding.id,
                  ),
              },
            },
            update: {
              email,
              name: displayName,
              permissions: [
                'training:join',
                'training:attendance:self',
              ],
              scopeSnapshot: {
                clinicianId:
                  String(
                    clinician.id,
                  ),
                specialty,
              },
              status: 'assigned',
              revokedAt: null,
              expiresAt: null,
              metadata: {
                source:
                  'legacy_onboarding_booking',
                qualificationTraining: true,
                onboardingId:
                  String(
                    onboarding.id,
                  ),
              },
            },
          });
    }

    if (!trainingSlotId || !assignment) {
      return json(
        {
          ok: false,
          error:
            requestedTrainingSlotId
              ? 'training_assignment_required'
              : 'training_booking_required',
        },
        409,
      );
    }

    if (
      assignment.principalType !==
        'clinician' ||
      String(
        assignment.principalId || '',
      ) !== String(clinician.id) ||
      String(
        assignment.principalKey || '',
      ) !== principalKey
    ) {
      return json(
        {
          ok: false,
          error:
            'training_assignment_identity_mismatch',
        },
        403,
      );
    }

    const assignmentStatus =
      String(
        assignment.status || '',
      )
        .trim()
        .toLowerCase();

    if (
      assignment.revokedAt ||
      (assignment.expiresAt &&
        new Date(
          assignment.expiresAt,
        ).getTime() <= now.getTime()) ||
      [
        'revoked',
        'expired',
        'declined',
      ].includes(assignmentStatus)
    ) {
      return json(
        {
          ok: false,
          error:
            'training_assignment_inactive',
        },
        403,
      );
    }

    if (assignmentStatus === 'invited') {
      return json(
        {
          ok: false,
          error:
            'training_invitation_acceptance_required',
          assignmentId:
            String(assignment.id),
          trainingSlotId,
        },
        409,
      );
    }

    if (
      ![
        'assigned',
        'accepted',
      ].includes(assignmentStatus)
    ) {
      return json(
        {
          ok: false,
          error:
            'training_assignment_inactive',
        },
        403,
      );
    }

    const trainingSlot =
      await db.clinicianTrainingSlot
        .findUnique({
          where: {
            id: trainingSlotId,
          },
        });

    if (!trainingSlot) {
      return json(
        {
          ok: false,
          error:
            'training_slot_not_found',
        },
        404,
      );
    }

    if (
      String(trainingSlot.status)
        .toLowerCase() ===
        'cancelled' ||
      trainingSlot.cancelledAt
    ) {
      return json(
        {
          ok: false,
          error:
            'training_slot_cancelled',
        },
        409,
      );
    }

    const expectedRoomId =
      `training-slot-${trainingSlotId}`;

    if (
      requestedRoomId &&
      requestedRoomId !==
        expectedRoomId
    ) {
      return json(
        {
          ok: false,
          error:
            'training_room_mismatch',
        },
        403,
      );
    }

    const admission =
      await issueTrainingAdmission({
        assignmentId:
          String(assignment.id),
        expectedPrincipalKey:
          principalKey,
        subjectId:
          String(clinician.id),
        uid:
          String(
            clinician.userId ||
            clinician.id,
          ),
        userAgent:
          request.headers.get(
            'user-agent',
          ),
        ipAddress:
          ipAddressFromRequest(
            request,
          ),
      });

    return json({
      ok: true,
      admission: {
        token:
          admission.token,
        admissionId:
          admission.admissionId,
        assignmentId:
          admission.assignmentId,
        roomId:
          admission.roomId,
        trainingSlotId:
          admission.trainingSlotId,
        sessionKey:
          admission.sessionKey,
        role:
          admission.role,
        uid:
          admission.uid,
        displayName:
          admission.displayName,
        notBeforeAt:
          admission.notBeforeAt
            .toISOString(),
        expiresAt:
          admission.expiresAt
            .toISOString(),
        joinOpensAt:
          admission.joinOpensAt
            .toISOString(),
        joinClosesAt:
          admission.joinClosesAt
            .toISOString(),
      },
    });
  }
  catch (error) {
    if (
      error instanceof
      TrainingAdmissionError
    ) {
      return json(
        {
          ok: false,
          error: error.code,
          ...(error.details || {}),
        },
        error.status,
      );
    }

    console.error(
      '[training admission][clinician] failed',
      error,
    );

    return json(
      {
        ok: false,
        error:
          'training_admission_unavailable',
      },
      500,
    );
  }
}
