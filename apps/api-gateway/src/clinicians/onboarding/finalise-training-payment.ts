import { prisma } from '@/src/lib/prisma';
import {
  resolveClinicianOnboardingEntitlements,
} from '@/src/clinicians/onboarding/entitlements';

type FinaliseTrainingPaymentInput = {
  clinicianId: string;
  slotId: string;
  paymentId?: string | null;
  onboardingId?: string | null;
  method: 'paystack' | 'eft' | 'manual' | 'internal';
  actorId?: string | null;
  notes?: string | null;
};

function cleanStr(
  value: unknown,
  max = 500,
): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max
    ? text.slice(0, max)
    : text;
}

function appendNote(
  existing: string | null | undefined,
  note: string,
) {
  return [
    cleanStr(existing, 4000),
    note,
  ]
    .filter(Boolean)
    .join('\n');
}

function jsonSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value ?? null),
  );
}

function asObject(value: unknown) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function normaliseMode(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'in_person'
    ? 'in_person'
    : 'virtual';
}

function itemIdentity(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function dispatchItemsFromLabels(
  labels: string[],
) {
  return labels.map((label, index) => ({
    kind:
      index <= 3
        ? 'device'
        : index <= 5
          ? 'paperwork'
          : 'merch',
    label,
    quantity: 1,
    sku:
      label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) ||
      `STARTER-KIT-${index + 1}`,
    isMandatory: true,
    isShipped: true,
  }));
}

function isPermanentDispatch(
  dispatch: any,
) {
  const status =
    String(dispatch?.status || '')
      .trim()
      .toLowerCase();

  if (
    status === 'canceled' ||
    status === 'cancelled'
  ) {
    return false;
  }

  const notes =
    String(dispatch?.notes || '')
      .trim()
      .toLowerCase();

  return !(
    notes.includes('temporary training') ||
    notes.includes('loaner training') ||
    notes.includes('training loan')
  );
}

export async function finaliseClinicianTrainingPayment(
  input: FinaliseTrainingPaymentInput,
) {
  const clinicianId =
    cleanStr(input.clinicianId, 120);
  const slotId =
    cleanStr(input.slotId, 120);
  const paymentId =
    cleanStr(input.paymentId, 120);
  const onboardingId =
    cleanStr(input.onboardingId, 120);
  const actorId =
    cleanStr(input.actorId, 120);

  if (!clinicianId) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'clinicianId_required',
      },
    };
  }

  if (!slotId) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'slotId_required',
      },
    };
  }

  return prisma.$transaction(
    async (tx: any) => {
      const clinician =
        await tx.clinicianProfile.findUnique({
          where: { id: clinicianId },
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
          where: { id: slotId },
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

      if (
        String(slot.status || '')
          .trim()
          .toLowerCase() !== 'published'
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'training_slot_not_published',
          },
        };
      }

      const now = new Date();

      if (
        new Date(slot.endsAt).getTime() <=
        now.getTime()
      ) {
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
        new Date(slot.bookingOpensAt).getTime() >
          now.getTime()
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'training_slot_booking_not_open',
          },
        };
      }

      if (
        slot.bookingClosesAt &&
        new Date(slot.bookingClosesAt).getTime() <=
          now.getTime()
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'training_slot_booking_closed',
          },
        };
      }

      const existingOnboarding =
        onboardingId
          ? await tx.clinicianOnboarding
              .findUnique({
                where: { id: onboardingId },
              })
          : await tx.clinicianOnboarding
              .findUnique({
                where: { clinicianId },
              });

      if (
        existingOnboarding &&
        String(
          existingOnboarding.clinicianId,
        ) !== clinicianId
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'onboarding_clinician_mismatch',
          },
        };
      }

      const currentPayment =
        paymentId
          ? await tx.clinicianOnboardingPayment
              .findUnique({
                where: { id: paymentId },
              })
          : null;

      if (paymentId && !currentPayment) {
        return {
          status: 404,
          body: {
            ok: false,
            error: 'payment_not_found',
          },
        };
      }

      if (
        currentPayment &&
        String(currentPayment.clinicianId) !==
          clinicianId
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'payment_clinician_mismatch',
          },
        };
      }

      const paymentMeta =
        asObject(currentPayment?.meta);

      const selectedMode =
        normaliseMode(
          paymentMeta.selectedMode ||
          paymentMeta.trainingMode ||
          existingOnboarding?.trainingMode ||
          slot.mode,
        );

      const allowedModes =
        Array.isArray(slot.allowedModes)
          ? slot.allowedModes.map(
              normaliseMode,
            )
          : [normaliseMode(slot.mode)];

      if (
        allowedModes.length &&
        !allowedModes.includes(selectedMode)
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'training_mode_not_available',
            allowedModes,
          },
        };
      }

      const currentPaymentStatus =
        input.method === 'paystack'
          ? 'captured'
          : 'redeemed';

      if (currentPayment) {
        await tx.clinicianOnboardingPayment
          .update({
            where: {
              id: currentPayment.id,
            },
            data: {
              clinicianId,
              status: currentPaymentStatus,
              confirmedAt:
                currentPayment.confirmedAt ||
                now,
              confirmedByUserId:
                actorId || undefined,
              meta: jsonSafe({
                ...paymentMeta,
                finalisedAt:
                  now.toISOString(),
                finalisedVia:
                  input.method,
                slotId,
                selectedMode,
              }),
            },
          });
      }

      const entitlements =
        await resolveClinicianOnboardingEntitlements(
          tx,
          clinicianId,
          existingOnboarding,
        );

      if (!entitlements.trainingAccess) {
        return {
          status: 409,
          body: {
            ok: false,
            error:
              'training_access_not_granted',
            clinicianId,
            paymentState:
              entitlements.paymentState,
            entitlements: {
              pathwayKey:
                entitlements.pathwayKey,
              approvedPayLater:
                entitlements.approvedPayLater,
              trainingAccess:
                entitlements.trainingAccess,
            },
            message:
              'The recorded payment or approval does not grant training access under the active Admin-configured onboarding policy.',
          },
        };
      }

      const alreadyOnThisSlot =
        String(
          existingOnboarding?.trainingSlotId ||
          '',
        ) === String(slot.id);

      const switchingFrom =
        existingOnboarding?.trainingSlotId &&
        !alreadyOnThisSlot
          ? String(
              existingOnboarding.trainingSlotId,
            )
          : null;

      if (!alreadyOnThisSlot) {
        const reserved =
          await tx.$executeRaw`
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

      const note =
        appendNote(
          existingOnboarding?.trainingNotes,
          [
            `Training access finalised via ${input.method} at ${now.toISOString()}`,
            `Commercial pathway: ${entitlements.pathwayKey || 'none'}`,
            `Amount paid: ${entitlements.paymentState.amountPaidCents}`,
            `Outstanding: ${entitlements.paymentState.outstandingCents}`,
            `Kit release: ${entitlements.starterKitRelease}`,
            cleanStr(input.notes, 1000),
          ]
            .filter(Boolean)
            .join(' | '),
        );

      const onboarding =
        await tx.clinicianOnboarding.upsert({
          where: { clinicianId },
          update: {
            status: 'training_scheduled',
            trainingSlotId: slot.id,
            trainingMode: selectedMode,
            depositPaid:
              entitlements.depositQualified,
            paymentPlan:
              entitlements.pathwayKey ||
              existingOnboarding?.paymentPlan ||
              undefined,
            trainingNotes: note,
          },
          create: {
            clinicianId,
            status: 'training_scheduled',
            trainingSlotId: slot.id,
            trainingMode: selectedMode,
            depositPaid:
              entitlements.depositQualified,
            paymentPlan:
              entitlements.pathwayKey ||
              undefined,
            trainingNotes: note,
          },
        });

      if (
        currentPayment &&
        String(currentPayment.onboardingId) !==
          String(onboarding.id)
      ) {
        await tx.clinicianOnboardingPayment
          .update({
            where: {
              id: currentPayment.id,
            },
            data: {
              onboardingId: onboarding.id,
            },
          });
      }

      if (switchingFrom) {
        await tx.$executeRaw`
          UPDATE "ClinicianTrainingSlot"
          SET
            "usedCount" =
              GREATEST(0, "usedCount" - 1),
            "updatedAt" = NOW()
          WHERE "id" = ${switchingFrom}
        `;
      }

      const permanentDispatches =
        await tx.clinicianDispatch.findMany({
          where: {
            clinicianId,
            onboardingId: onboarding.id,
          },
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      const alreadyDispatched =
        new Set<string>();

      for (const dispatch of permanentDispatches) {
        if (!isPermanentDispatch(dispatch)) {
          continue;
        }

        for (
          const item of
          Array.isArray(dispatch.items)
            ? dispatch.items
            : []
        ) {
          const identity =
            itemIdentity(item?.label);

          if (identity) {
            alreadyDispatched.add(identity);
          }
        }
      }

      const missingKitItems =
        entitlements.starterKitItems.filter(
          (label: string) =>
            !alreadyDispatched.has(
              itemIdentity(label),
            ),
        );

      let dispatch =
        permanentDispatches.find(
          isPermanentDispatch,
        ) || null;

      if (missingKitItems.length) {
        dispatch =
          await tx.clinicianDispatch.create({
            data: {
              clinicianId,
              onboardingId: onboarding.id,
              courier:
                'Pending admin assignment',
              trackingCode: 'Pending',
              trackingUrl: null,
              status: 'pending',
              notes: [
                'Server-authorised onboarding kit release.',
                `Release level: ${entitlements.starterKitRelease}`,
                `Commercial pathway: ${entitlements.pathwayKey}`,
                'Admin must assign courier and tracking before shipment.',
              ].join(' '),
              items: {
                create:
                  dispatchItemsFromLabels(
                    missingKitItems,
                  ),
              },
            },
            include: {
              items: true,
            },
          });
      }

      if (currentPayment) {
        await tx.clinicianOnboardingPayment
          .update({
            where: {
              id: currentPayment.id,
            },
            data: {
              meta: jsonSafe({
                ...paymentMeta,
                finalisedAt:
                  now.toISOString(),
                finalisedVia:
                  input.method,
                slotId,
                selectedMode,
                entitlementSnapshot: {
                  resolvedAt:
                    entitlements.resolvedAt,
                  pathwayKey:
                    entitlements.pathwayKey,
                  privileges:
                    entitlements.privileges,
                  starterKitRelease:
                    entitlements.starterKitRelease,
                  starterKitItems:
                    entitlements.starterKitItems,
                  paymentState:
                    entitlements.paymentState,
                },
              }),
            },
          });
      }

      await tx.clinicianProfile.update({
        where: { id: clinicianId },
        data: {
          trainingScheduledAt:
            slot.startsAt,
        },
      });

      return {
        status: 200,
        body: {
          ok: true,
          clinicianId,
          paymentState:
            entitlements.paymentState,
          entitlements: {
            pathwayKey:
              entitlements.pathwayKey,
            pathwayLabel:
              entitlements.pathwayLabel,
            privileges:
              entitlements.privileges,
            trainingAccess:
              entitlements.trainingAccess,
            practiceActivation:
              entitlements.practiceActivation,
            starterKitRelease:
              entitlements.starterKitRelease,
            starterKitItems:
              entitlements.starterKitItems,
            platformIndemnityEligible:
              entitlements
                .platformIndemnityEligible,
            balanceRecoveryApplies:
              entitlements
                .balanceRecoveryApplies,
          },
          training: {
            status: 'scheduled',
            startAt:
              slot.startsAt.toISOString(),
            endAt:
              slot.endsAt.toISOString(),
            mode: selectedMode,
            joinUrl:
              slot.meetingUrl ?? null,
            paid:
              entitlements.paymentState
                .initialRequirementMet,
            accessGranted: true,
          },
          onboarding: {
            id: onboarding.id,
            stage: onboarding.status,
            depositPaid:
              onboarding.depositPaid,
            trainingSlotId:
              onboarding.trainingSlotId,
            trainingMode:
              onboarding.trainingMode,
            paymentPlan:
              onboarding.paymentPlan,
            paymentStatus:
              entitlements.paymentState
                .paymentStatus,
            amountPaidCents:
              entitlements.paymentState
                .amountPaidCents,
            outstandingCents:
              entitlements.paymentState
                .outstandingCents,
          },
          dispatch: dispatch
            ? {
                id: dispatch.id,
                status: dispatch.status,
                authorisedRelease:
                  entitlements
                    .starterKitRelease,
                authorisedItems:
                  entitlements
                    .starterKitItems,
                newlyCreatedItems:
                  missingKitItems,
              }
            : null,
        },
      };
    },
  );
}
