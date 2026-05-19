// apps/api-gateway/src/clinicians/onboarding/finalise-training-payment.ts
import { prisma } from '@/src/lib/prisma';
import {
  calculateOnboardingPaymentState,
  getClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';

type FinaliseTrainingPaymentInput = {
  clinicianId: string;
  slotId: string;
  paymentId?: string | null;
  onboardingId?: string | null;
  method: 'paystack' | 'eft' | 'manual' | 'internal';
  actorId?: string | null;
  notes?: string | null;
};

const CONFIRMED_PAYMENT_STATUSES = ['captured', 'confirmed', 'redeemed', 'paid'];

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function appendNote(existing: string | null | undefined, note: string) {
  return [cleanStr(existing, 4000), note].filter(Boolean).join('\n');
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function defaultDispatchItemsFromLabels(labels: string[]) {
  return labels.map((label, index) => ({
    kind: index <= 3 ? 'device' : index <= 5 ? 'paperwork' : 'merch',
    label,
    quantity: 1,
    sku:
      label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || `STARTER-KIT-${index + 1}`,
    isMandatory: true,
    isShipped: true,
  }));
}

async function confirmedAmountPaidBeforeCurrentPayment(
  tx: any,
  clinicianId: string,
  excludePaymentId?: string | null,
) {
  const rows = await tx.clinicianOnboardingPayment.findMany({
    where: {
      clinicianId,
      status: { in: CONFIRMED_PAYMENT_STATUSES },
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
    },
    select: { amountCents: true },
  });

  return rows.reduce((sum: number, row: any) => {
    const n = Number(row?.amountCents || 0);
    return sum + (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
  }, 0);
}

export async function finaliseClinicianTrainingPayment(input: FinaliseTrainingPaymentInput) {
  const clinicianId = cleanStr(input.clinicianId, 120);
  const slotId = cleanStr(input.slotId, 120);
  const paymentId = cleanStr(input.paymentId, 120);
  const onboardingId = cleanStr(input.onboardingId, 120);
  const actorId = cleanStr(input.actorId, 120);
  const method = input.method;

  if (!clinicianId) {
    return { status: 400, body: { ok: false, error: 'clinicianId_required' } };
  }

  if (!slotId) {
    return { status: 400, body: { ok: false, error: 'slotId_required' } };
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const settings = await getClinicianOnboardingSettings(tx);

    const clinician = await tx.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });

    if (!clinician) {
      return { status: 404, body: { ok: false, error: 'clinician_not_found' } };
    }

    const slot = await tx.clinicianTrainingSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return { status: 404, body: { ok: false, error: 'training_slot_not_found' } };
    }

    const existingOnboarding = onboardingId
      ? await tx.clinicianOnboarding.findUnique({ where: { id: onboardingId } })
      : await tx.clinicianOnboarding.findUnique({ where: { clinicianId } });

    if (existingOnboarding && String(existingOnboarding.clinicianId) !== clinicianId) {
      return { status: 409, body: { ok: false, error: 'onboarding_clinician_mismatch' } };
    }

    const currentPayment = paymentId
      ? await tx.clinicianOnboardingPayment.findUnique({ where: { id: paymentId } })
      : null;

    if (paymentId && !currentPayment) {
      return { status: 404, body: { ok: false, error: 'payment_not_found' } };
    }

    if (currentPayment && String(currentPayment.clinicianId) !== clinicianId) {
      return { status: 409, body: { ok: false, error: 'payment_clinician_mismatch' } };
    }

    const currentPaymentStatus = method === 'paystack' ? 'captured' : 'redeemed';
    const amountPaidBefore = await confirmedAmountPaidBeforeCurrentPayment(tx, clinicianId, paymentId);
    const currentAmount = currentPayment ? Math.max(0, Math.round(Number(currentPayment.amountCents || 0))) : 0;
    const projectedAmountPaid = amountPaidBefore + currentAmount;

    const paymentState = calculateOnboardingPaymentState({
      trainingFeeCents: settings.trainingFeeCents,
      minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
      amountPaidCents: projectedAmountPaid,
    });

    if (paymentId && currentPayment) {
      await tx.clinicianOnboardingPayment.update({
        where: { id: paymentId },
        data: {
          clinicianId,
          status: currentPaymentStatus,
          confirmedAt: new Date(),
          confirmedByUserId: actorId || undefined,
          meta: jsonSafe({
            ...(currentPayment.meta && typeof currentPayment.meta === 'object' ? currentPayment.meta : {}),
            finalisedAt: new Date().toISOString(),
            finalisedVia: method,
            slotId,
            paymentState,
          }),
        },
      });
    }

    if (!paymentState.initialRequirementMet) {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'minimum_initial_payment_not_met',
          clinicianId,
          paymentState,
          message:
            'Payment was recorded, but the confirmed amount is below the configured minimum initial payment required to schedule training.',
        },
      };
    }

    const switchingSlot =
      !!existingOnboarding?.trainingSlotId && String(existingOnboarding.trainingSlotId) !== slotId;
    const alreadyOnThisSlot = String(existingOnboarding?.trainingSlotId || '') === slotId;
    const needsSeat = !alreadyOnThisSlot;
    const seatsLeft = Math.max(0, Number(slot.capacity || 0) - Number(slot.usedCount || 0));

    if (needsSeat && seatsLeft <= 0) {
      return { status: 409, body: { ok: false, error: 'training_slot_full' } };
    }

    const note = appendNote(
      existingOnboarding?.trainingNotes,
      [
        `Training payment threshold met via ${method} at ${new Date().toISOString()}`,
        `Amount paid: ${paymentState.amountPaidCents}`,
        `Outstanding: ${paymentState.outstandingCents}`,
        `Payment status: ${paymentState.paymentStatus}`,
        cleanStr(input.notes, 1000),
      ]
        .filter(Boolean)
        .join(' | '),
    );

    const onboarding = await tx.clinicianOnboarding.upsert({
      where: { clinicianId },
      update: {
        status: 'training_scheduled',
        trainingSlotId: slot.id,
        depositPaid: true,
        trainingNotes: note,
      },
      create: {
        clinicianId,
        status: 'training_scheduled',
        trainingSlotId: slot.id,
        depositPaid: true,
        trainingNotes: note,
      },
    });

    if (paymentId && currentPayment) {
      await tx.clinicianOnboardingPayment.update({
        where: { id: paymentId },
        data: {
          onboardingId: onboarding.id,
          clinicianId,
          status: currentPaymentStatus,
          confirmedAt: currentPayment.confirmedAt || new Date(),
          confirmedByUserId: actorId || undefined,
        },
      });
    }

    if (needsSeat) {
      await tx.clinicianTrainingSlot.update({
        where: { id: slot.id },
        data: { usedCount: { increment: 1 } },
      });

      if (switchingSlot && existingOnboarding?.trainingSlotId) {
        await tx.clinicianTrainingSlot
          .update({
            where: { id: String(existingOnboarding.trainingSlotId) },
            data: { usedCount: { decrement: 1 } },
          })
          .catch(() => null);
      }
    }

    let dispatch = await tx.clinicianDispatch.findFirst({
      where: { clinicianId, onboardingId: onboarding.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    if (!dispatch) {
      dispatch = await tx.clinicianDispatch.create({
        data: {
          clinicianId,
          onboardingId: onboarding.id,
          courier: 'Pending admin assignment',
          trackingCode: 'Pending',
          trackingUrl: null,
          status: 'pending',
          notes:
            'Created automatically after clinician onboarding minimum initial payment was confirmed. Admin to assign courier and tracking.',
          items: { create: defaultDispatchItemsFromLabels(settings.starterKitItems) },
        },
        include: { items: true },
      });
    }

    await tx.clinicianProfile.update({
      where: { id: clinicianId },
      data: { trainingScheduledAt: slot.startsAt },
    });

    return {
      status: 200,
      body: {
        ok: true,
        clinicianId,
        paymentState,
        training: {
          status: 'scheduled',
          startAt: slot.startsAt.toISOString(),
          endAt: slot.endsAt.toISOString(),
          mode: slot.mode,
          joinUrl: slot.meetingUrl ?? null,
          paid: true,
        },
        onboarding: {
          id: onboarding.id,
          stage: onboarding.status,
          depositPaid: onboarding.depositPaid,
          trainingSlotId: onboarding.trainingSlotId,
          paymentStatus: paymentState.paymentStatus,
          amountPaidCents: paymentState.amountPaidCents,
          outstandingCents: paymentState.outstandingCents,
        },
        dispatch: {
          id: dispatch.id,
          status: dispatch.status,
          items: Array.isArray(dispatch.items) ? dispatch.items.length : 0,
        },
      },
    };
  });

  return result;
}
