import { prisma } from '@/src/lib/prisma';
import {
  resolveClinicianOnboardingEntitlements,
} from '@/src/clinicians/onboarding/entitlements';

export type ClinicianTrainingMode =
  | 'virtual'
  | 'in_person';

export type NormalisedTrainingSession = {
  id: string;
  dayNumber: number;
  startAt: string;
  endAt: string;
  mode: ClinicianTrainingMode | 'both';
  meetingUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  trainerName: string | null;
};

function cleanText(value: unknown, max = 500) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

export function normaliseTrainingMode(
  value: unknown,
): ClinicianTrainingMode {
  return String(value || '').trim().toLowerCase() === 'in_person'
    ? 'in_person'
    : 'virtual';
}

function jsonArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function normaliseAllowedTrainingModes(
  value: unknown,
  fallbackMode?: unknown,
): ClinicianTrainingMode[] {
  const modes = jsonArray(value)
    .map(normaliseTrainingMode)
    .filter(
      (mode, index, rows) =>
        rows.indexOf(mode) === index,
    );

  if (modes.length) return modes;

  const fallback = String(fallbackMode || '').trim().toLowerCase();

  if (fallback === 'both' || fallback === 'hybrid') {
    return ['virtual', 'in_person'];
  }

  return [normaliseTrainingMode(fallbackMode)];
}

export function normaliseTrainingSessions(
  value: unknown,
  slot?: any,
): NormalisedTrainingSession[] {
  const sessions = jsonArray(value)
    .map(
      (
        raw,
        index,
      ): NormalisedTrainingSession | null => {
      const startAt = new Date(String(raw?.startAt || ''));
      const endAt = new Date(String(raw?.endAt || ''));

      if (
        !Number.isFinite(startAt.getTime()) ||
        !Number.isFinite(endAt.getTime()) ||
        endAt <= startAt
      ) {
        return null;
      }

      return {
        id:
          cleanText(raw?.id, 120) ||
          `session-${index + 1}`,
        dayNumber: Math.max(
          1,
          Math.round(Number(raw?.dayNumber || index + 1)),
        ),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        mode:
          String(raw?.mode || '').trim().toLowerCase() === 'both'
            ? 'both'
            : normaliseTrainingMode(raw?.mode || slot?.mode),
        meetingUrl: cleanText(raw?.meetingUrl, 1000),
        venueName: cleanText(raw?.venueName, 240),
        venueAddress: cleanText(raw?.venueAddress, 1000),
        trainerName: cleanText(raw?.trainerName, 240),
      };
      },
    )
    .filter(
      (
        session,
      ): session is NormalisedTrainingSession =>
        session !== null,
    );

  if (sessions.length) {
    return sessions;
  }

  if (slot?.startsAt && slot?.endsAt) {
    return [
      {
        id: 'session-1',
        dayNumber: 1,
        startAt: new Date(slot.startsAt).toISOString(),
        endAt: new Date(slot.endsAt).toISOString(),
        mode:
          String(slot.mode || '').toLowerCase() === 'both'
            ? 'both'
            : normaliseTrainingMode(slot.mode),
        meetingUrl: cleanText(slot.meetingUrl, 1000),
        venueName: cleanText(slot.venueName, 240),
        venueAddress: cleanText(slot.venueAddress, 1000),
        trainerName: cleanText(slot.trainerName, 240),
      },
    ];
  }

  return [];
}

export function publicTrainingSlot(slot: any) {
  const allowedModes =
    normaliseAllowedTrainingModes(
      slot?.allowedModes,
      slot?.mode,
    );

  const capacity = Math.max(
    0,
    Math.round(Number(slot?.capacity || 0)),
  );

  const usedCount = Math.max(
    0,
    Math.round(Number(slot?.usedCount || 0)),
  );

  return {
    id: String(slot.id),
    title:
      cleanText(slot.title, 240) ||
      'Mandatory Clinician Training',
    summary: cleanText(slot.summary, 1000),
    status: String(slot.status || 'draft'),
    startAt: new Date(slot.startsAt).toISOString(),
    endAt: new Date(slot.endsAt).toISOString(),
    timezone:
      cleanText(slot.timezone, 120) ||
      'Africa/Johannesburg',
    durationDays: Math.max(
      1,
      Math.round(Number(slot.durationDays || 1)),
    ),
    totalDurationMinutes: Math.max(
      1,
      Math.round(Number(slot.totalDurationMinutes || 60)),
    ),
    capacity,
    usedCount,
    seatsLeft: Math.max(0, capacity - usedCount),
    mode:
      allowedModes.length > 1
        ? 'both'
        : allowedModes[0],
    allowedModes,
    sessions: normaliseTrainingSessions(
      slot.sessions,
      slot,
    ),
    trainerName: cleanText(slot.trainerName, 240),
    venueName: cleanText(slot.venueName, 240),
    venueAddress: cleanText(slot.venueAddress, 1000),
    virtualInstructions: cleanText(
      slot.virtualInstructions,
      2000,
    ),
    inPersonInstructions: cleanText(
      slot.inPersonInstructions,
      2000,
    ),
    bookingOpensAt: slot.bookingOpensAt
      ? new Date(slot.bookingOpensAt).toISOString()
      : null,
    bookingClosesAt: slot.bookingClosesAt
      ? new Date(slot.bookingClosesAt).toISOString()
      : null,
  };
}

export async function bookClinicianTrainingSlot(input: {
  clinicianId: string;
  slotId: string;
  mode: ClinicianTrainingMode;
}) {
  return prisma.$transaction(async (tx: any) => {
    const clinician =
      await tx.clinicianProfile.findUnique({
        where: {
          id: input.clinicianId,
        },
      });

    if (!clinician) {
      return {
        status: 404,
        body: {
          ok: false,
          error: 'clinician_not_found',
        },
      };
    }

    const slot =
      await tx.clinicianTrainingSlot.findUnique({
        where: {
          id: input.slotId,
        },
      });

    if (!slot) {
      return {
        status: 404,
        body: {
          ok: false,
          error: 'training_slot_not_found',
        },
      };
    }

    if (String(slot.status || '').toLowerCase() !== 'published') {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'training_slot_not_published',
        },
      };
    }

    const now = Date.now();

    if (new Date(slot.endsAt).getTime() <= now) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'training_slot_has_ended',
        },
      };
    }

    if (
      slot.bookingOpensAt &&
      new Date(slot.bookingOpensAt).getTime() > now
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'training_slot_booking_not_open',
        },
      };
    }

    if (
      slot.bookingClosesAt &&
      new Date(slot.bookingClosesAt).getTime() <= now
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'training_slot_booking_closed',
        },
      };
    }

    const allowedModes =
      normaliseAllowedTrainingModes(
        slot.allowedModes,
        slot.mode,
      );

    if (!allowedModes.includes(input.mode)) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'training_mode_not_available',
          allowedModes,
        },
      };
    }

    const existing =
      await tx.clinicianOnboarding.findUnique({
        where: {
          clinicianId: input.clinicianId,
        },
      });

    if (
      String(existing?.status || '')
        .trim()
        .toLowerCase() ===
      'training_completed'
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          error:
            'completed_training_cannot_be_rescheduled',
        },
      };
    }

    const access =
      await resolveClinicianOnboardingEntitlements(
        tx,
        input.clinicianId,
        existing,
      );

    if (!access.trainingAccess) {
      return {
        status: 403,
        body: {
          ok: false,
          error: 'training_access_payment_or_approval_required',
          paymentState: access.paymentState,
          entitlements: {
            pathwayKey:
              access.pathwayKey,
            approvedPayLater:
              access.approvedPayLater,
            trainingAccess:
              access.trainingAccess,
          },
        },
      };
    }

    const alreadyOnSlot =
      String(existing?.trainingSlotId || '') ===
      String(slot.id);

    if (!alreadyOnSlot) {
      const reserved = await tx.$executeRaw`
        UPDATE "ClinicianTrainingSlot"
        SET
          "usedCount" = "usedCount" + 1,
          "updatedAt" = NOW()
        WHERE
          "id" = ${String(slot.id)}
          AND "status" = 'published'
          AND "usedCount" < "capacity"
      `;

      if (Number(reserved) !== 1) {
        return {
          status: 409,
          body: {
            ok: false,
            error: 'training_slot_full',
          },
        };
      }
    }

    const switchingFrom =
      existing?.trainingSlotId &&
      String(existing.trainingSlotId) !== String(slot.id)
        ? String(existing.trainingSlotId)
        : null;

    const onboarding =
      await tx.clinicianOnboarding.upsert({
        where: {
          clinicianId: input.clinicianId,
        },
        update: {
          status: 'training_scheduled',
          trainingSlotId: String(slot.id),
          trainingMode: input.mode,
          depositPaid:
            access.depositQualified,
          paymentPlan:
            access.pathwayKey ||
            existing?.paymentPlan ||
            undefined,
        },
        create: {
          clinicianId: input.clinicianId,
          status: 'training_scheduled',
          trainingSlotId: String(slot.id),
          trainingMode: input.mode,
          depositPaid:
            access.depositQualified,
          paymentPlan:
            access.pathwayKey ||
            undefined,
        },
      });

    const nowDate = new Date();
    const principalKey =
      `clinician:${String(
        input.clinicianId,
      )}`;
    const displayName =
      cleanText(
        clinician.displayName ||
          clinician.fullName ||
          clinician.name ||
          clinician.email,
        240,
      ) || 'Clinician';

    await tx
      .clinicianTrainingParticipantAssignment
      .upsert({
        where: {
          trainingSlotId_sessionKey_principalKey: {
            trainingSlotId:
              String(slot.id),
            sessionKey: 'slot',
            principalKey,
          },
        },
        create: {
          trainingSlotId:
            String(slot.id),
          sessionKey: 'slot',
          principalType: 'clinician',
          principalKey,
          principalId:
            String(input.clinicianId),
          email:
            cleanText(
              clinician.email,
              320,
            ),
          name: displayName,
          role: 'clinician',
          permissions: [
            'training:join',
            'training:attendance:self',
          ],
          status: 'assigned',
          assignedAt: nowDate,
          metadata: {
            source:
              switchingFrom
                ? 'clinician_reschedule'
                : 'clinician_booking',
            onboardingId:
              String(onboarding.id),
          },
        },
        update: {
          email:
            cleanText(
              clinician.email,
              320,
            ),
          name: displayName,
          permissions: [
            'training:join',
            'training:attendance:self',
          ],
          status: 'assigned',
          assignedAt: nowDate,
          revokedAt: null,
          expiresAt: null,
          metadata: {
            source:
              switchingFrom
                ? 'clinician_reschedule'
                : 'clinician_booking',
            onboardingId:
              String(onboarding.id),
          },
        },
      });

    if (switchingFrom) {
      const oldAssignments =
        await tx
          .clinicianTrainingParticipantAssignment
          .findMany({
            where: {
              trainingSlotId:
                switchingFrom,
              principalType:
                'clinician',
              principalId:
                String(
                  input.clinicianId,
                ),
              status: {
                in: [
                  'assigned',
                  'accepted',
                  'invited',
                ],
              },
            },
            select: {
              id: true,
            },
          });

      const oldAssignmentIds =
        oldAssignments.map(
          (assignment: any) =>
            String(assignment.id),
        );

      if (oldAssignmentIds.length) {
        await tx
          .clinicianTrainingAdmission
          .updateMany({
            where: {
              assignmentId: {
                in: oldAssignmentIds,
              },
              revokedAt: null,
            },
            data: {
              revokedAt: nowDate,
            },
          });

        await tx
          .clinicianTrainingParticipantAssignment
          .updateMany({
            where: {
              id: {
                in: oldAssignmentIds,
              },
            },
            data: {
              status: 'revoked',
              revokedAt: nowDate,
            },
          });
      }

      await tx.$executeRaw`
        UPDATE "ClinicianTrainingSlot"
        SET
          "usedCount" = GREATEST(0, "usedCount" - 1),
          "updatedAt" = NOW()
        WHERE "id" = ${switchingFrom}
      `;
    }

    await tx.clinicianProfile.update({
      where: {
        id: input.clinicianId,
      },
      data: {
        trainingScheduledAt: slot.startsAt,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        training: {
          ...publicTrainingSlot({
            ...slot,
            usedCount:
              Number(slot.usedCount || 0) +
              (alreadyOnSlot ? 0 : 1),
          }),
          status: 'scheduled',
          selectedMode: input.mode,
          paid:
            access.paymentState
              .initialRequirementMet,
          accessGranted:
            access.trainingAccess,
          waiverActive:
            access.approvedPayLater,
          entitlements: {
            pathwayKey:
              access.pathwayKey,
            privileges:
              access.privileges,
            starterKitRelease:
              access.starterKitRelease,
            platformIndemnityEligible:
              access.platformIndemnityEligible,
            balanceRecoveryApplies:
              access.balanceRecoveryApplies,
          },
        },
        onboarding: {
          id: onboarding.id,
          stage: onboarding.status,
          trainingSlotId: onboarding.trainingSlotId,
          trainingMode: onboarding.trainingMode,
        },
      },
    };
  });
}
