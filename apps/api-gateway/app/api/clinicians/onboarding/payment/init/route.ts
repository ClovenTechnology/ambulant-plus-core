// apps/api-gateway/app/api/clinicians/onboarding/payment/init/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getProvider } from '@/src/payments';
import {
  calculateOnboardingPaymentState,
  getClinicianOnboardingSettings,
  type ClinicianOnboardingPathwayKey,
} from '@/src/clinicians/onboarding/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function makeReference(clinicianId: string) {
  return `amb_trn_${clinicianId.slice(-8)}_${crypto.randomBytes(6).toString('hex')}`;
}

function buildCallbackUrl(req: NextRequest, clinicianId: string, slotId: string, reference: string) {
  const configured = cleanStr(process.env.CLINICIAN_TRAINING_PAYMENT_CALLBACK_URL, 900);
  const base = configured || `${req.nextUrl.origin}/training/schedule`;
  const url = new URL(base);
  url.searchParams.set('clinicianId', clinicianId);
  url.searchParams.set('slotId', slotId);
  url.searchParams.set('paymentRef', reference);
  url.searchParams.set('paymentProvider', 'paystack');
  url.searchParams.set('reason', 'payment_callback');
  return url.toString();
}


const CONFIRMED_PAYMENT_STATUSES = [
  'captured',
  'confirmed',
  'redeemed',
  'paid',
];

function pathwayKeyFromValue(
  value: unknown,
): ClinicianOnboardingPathwayKey | null {
  const key = String(
    value || '',
  )
    .trim()
    .toUpperCase();

  if (
    key === 'START_NOW_PAY_LATER' ||
    key === 'QUALIFYING_DEPOSIT' ||
    key === 'FULL_PAYMENT'
  ) {
    return key;
  }

  return null;
}

async function confirmedOnboardingAmountCents(
  clinicianId: string,
) {
  const rows =
    await prisma.clinicianOnboardingPayment.findMany({
      where: {
        clinicianId,
        status: {
          in: CONFIRMED_PAYMENT_STATUSES as any,
        },
      },
      select: {
        amountCents: true,
        provider: true,
      },
    });

  return rows.reduce(
    (sum: number, row: any) => {
      const provider = String(
        row?.provider || '',
      )
        .trim()
        .toLowerCase();

      if (
        provider === 'waiver' ||
        provider === 'deferred'
      ) {
        return sum;
      }

      const amount = Number(
        row?.amountCents || 0,
      );

      return (
        sum +
        (Number.isFinite(amount)
          ? Math.max(
              0,
              Math.round(amount),
            )
          : 0)
      );
    },
    0,
  );
}
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const clinicianId = cleanStr(body.clinicianId, 120);
    const slotId = cleanStr(body.slotId || body.trainingSlotId, 120);

    if (!clinicianId) return NextResponse.json({ ok: false, error: 'clinicianId_required' }, { status: 400 });
    if (!slotId) return NextResponse.json({ ok: false, error: 'slotId_required' }, { status: 400 });

    const settings = await getClinicianOnboardingSettings();
    if (!settings.cardPaymentEnabled) {
      return NextResponse.json({ ok: false, error: 'card_payment_disabled' }, { status: 409 });
    }
    if (settings.trainingFeeCents <= 0) {
      return NextResponse.json({ ok: false, error: 'training_fee_not_configured' }, { status: 409 });
    }
    if (settings.paymentProvider !== 'paystack') {
      return NextResponse.json({ ok: false, error: 'unsupported_training_payment_provider' }, { status: 409 });
    }

    const pathwayKey = pathwayKeyFromValue(
      body.pathwayKey ||
        body.paymentPathway ||
        body.onboardingPathway,
    );

    if (!pathwayKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'pathwayKey_required',
        },
        { status: 400 },
      );
    }

    const configuredPathway =
      settings.commercialPathways.find(
        (pathway) =>
          pathway.key === pathwayKey,
      );

    if (
      !configuredPathway ||
      configuredPathway.enabled !== true
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'onboarding_pathway_disabled',
          pathwayKey,
        },
        { status: 409 },
      );
    }

    if (
      pathwayKey ===
      'START_NOW_PAY_LATER'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'pay_later_requires_admin_review',
          pathwayKey,
          paymentRequired: false,
          message:
            'Pay Later cannot be initialized as a card transaction and requires a separate Admin review request.',
        },
        { status: 409 },
      );
    }

    const clinician = await prisma.clinicianProfile.findUnique({ where: { id: clinicianId } });
    if (!clinician) return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });

    const slot = await prisma.clinicianTrainingSlot.findUnique({ where: { id: slotId } });
    if (!slot) return NextResponse.json({ ok: false, error: 'training_slot_not_found' }, { status: 404 });

    const onboarding = await prisma.clinicianOnboarding.upsert({
      where: { clinicianId },
      update: {},
      create: { clinicianId, status: 'pending', depositPaid: false },
    });

    const alreadyOnThisSlot = String(onboarding.trainingSlotId || '') === slotId;
    const seatsLeft = Math.max(0, Number(slot.capacity || 0) - Number(slot.usedCount || 0));
    if (!alreadyOnThisSlot && seatsLeft <= 0) {
      return NextResponse.json({ ok: false, error: 'training_slot_full' }, { status: 409 });
    }

    const email = cleanStr(body.email || clinician.email, 320);
    if (!email) return NextResponse.json({ ok: false, error: 'email_required_for_paystack' }, { status: 400 });

    const amountPaidCents =
      await confirmedOnboardingAmountCents(
        clinicianId,
      );

    const paymentStateBefore =
      calculateOnboardingPaymentState({
        trainingFeeCents:
          settings.trainingFeeCents,
        minimumInitialPaymentCents:
          settings.minimumInitialPaymentCents,
        amountPaidCents,
      });

    const chargeAmountCents =
      pathwayKey ===
      'QUALIFYING_DEPOSIT'
        ? Math.max(
            0,
            paymentStateBefore.minimumInitialPaymentCents -
              paymentStateBefore.amountPaidCents,
          )
        : paymentStateBefore.outstandingCents;

    if (chargeAmountCents <= 0) {
      const reason =
        pathwayKey ===
        'QUALIFYING_DEPOSIT'
          ? 'initial_requirement_already_met'
          : 'onboarding_fee_already_paid';

      return NextResponse.json(
        {
          ok: true,
          paymentRequired: false,
          pathwayKey,
          reason,
          paymentState: paymentStateBefore,
          message:
            pathwayKey ===
            'QUALIFYING_DEPOSIT'
              ? 'The configured initial-payment requirement has already been satisfied.'
              : 'The onboarding fee has already been paid in full.',
        },
        { status: 200 },
      );
    }

    const provider = getProvider('paystack');
    const reference = makeReference(clinicianId);
    const callbackUrl = cleanStr(body.callbackUrl, 900) || buildCallbackUrl(req, clinicianId, slotId, reference);

    const payment = await prisma.clinicianOnboardingPayment.create({
      data: {
        clinicianId,
        onboardingId: onboarding.id,
        amountCents: chargeAmountCents,
        currency: settings.currency,
        provider: 'paystack',
        status: 'pending',
        providerReference: reference,
        meta: jsonSafe({
          source: 'clinician_training_payment_init',
          pathwayKey,
          slotId,
          callbackUrl,
          clinicianEmail: email,
          settings: {
            trainingFeeCents: settings.trainingFeeCents,
            minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
            allowPartialPayment: settings.allowPartialPayment,
            amountPaidCents,
            chargeAmountCents,
            paymentStateBefore,
            currency: settings.currency,
            paymentProvider: settings.paymentProvider,
          },
        }),
      },
    });

    const checkout = await provider.initializeCheckout({
      amountCents: chargeAmountCents,
      currency: settings.currency,
      email,
      reference,
      callbackUrl,
      metadata: {
        purpose: 'clinician_training_onboarding',
        pathwayKey,
        clinicianId,
        onboardingId: onboarding.id,
        slotId,
        paymentId: payment.id,
      },
    });

    const updated = await prisma.clinicianOnboardingPayment.update({
      where: { id: payment.id },
      data: {
        providerReference: checkout.reference,
        meta: jsonSafe({
          source: 'clinician_training_payment_init',
          pathwayKey,
          slotId,
          callbackUrl,
          clinicianEmail: email,
          settings: {
            trainingFeeCents: settings.trainingFeeCents,
            minimumInitialPaymentCents: settings.minimumInitialPaymentCents,
            allowPartialPayment: settings.allowPartialPayment,
            amountPaidCents,
            chargeAmountCents,
            paymentStateBefore,
            currency: settings.currency,
            paymentProvider: settings.paymentProvider,
          },
          checkout: checkout.raw ?? null,
          redirectUrl: checkout.redirectUrl ?? null,
        }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        paymentRequired: true,
        pathwayKey,
        paymentStateBefore,
        payment: {
          id: updated.id,
          status: updated.status,
          provider: updated.provider,
          providerReference: updated.providerReference,
          amountCents: updated.amountCents,
          currency: updated.currency,
        },
        redirectUrl: checkout.redirectUrl,
        providerReference: checkout.reference,
        status: checkout.status,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('[clinician-training-payment-init] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'payment_init_failed' }, { status: 500 });
  }
}

