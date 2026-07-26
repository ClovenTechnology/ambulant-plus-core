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

    const trainingSlotId =
      cleanText(
        onboarding?.trainingSlotId,
        240,
      );

    if (
      !onboarding ||
      !trainingSlotId
    ) {
      return json(
        {
          ok: false,
          error:
            'training_booking_required',
        },
        409,
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

    const principalKey =
      trainingPrincipalKey(
        'clinician',
        String(clinician.id),
      );

    const sessionKey = 'slot';

    const compoundKey = {
      trainingSlotId,
      sessionKey,
      principalKey,
    };

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

    const assignment =
      await db
        .clinicianTrainingParticipantAssignment
        .upsert({
          where: {
            trainingSlotId_sessionKey_principalKey:
              compoundKey,
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
              new Date(),
            metadata: {
              source:
                'clinician_booking',
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
            metadata: {
              source:
                'clinician_booking',
              onboardingId:
                String(
                  onboarding.id,
                ),
            },
          },
        });

    if (
      assignment.status ===
        'revoked' ||
      assignment.status ===
        'expired'
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
