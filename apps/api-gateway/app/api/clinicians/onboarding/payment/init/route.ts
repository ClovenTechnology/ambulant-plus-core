// apps/api-gateway/app/api/clinicians/onboarding/payment/init/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getProvider } from '@/src/payments';
import {
  calculateOnboardingPaymentState,
  effectiveClinicianPathwayPricing,
  getClinicianOnboardingSettings,
  type ClinicianOnboardingPathwayKey,
} from '@/src/clinicians/onboarding/settings';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';

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

    const identity =
      await resolveAuthenticatedClinician(
        req,
        clinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const clinician = identity.clinician;
    const settings = await getClinicianOnboardingSettings();
    if (!settings.cardPaymentEnabled) {
      return NextResponse.json({ ok: false, error: 'card_payment_disabled' }, { status: 409 });
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

    if (pathwayKey === 'START_NOW_PAY_LATER') {
      return NextResponse.json(
        {
          ok: true,
          pathwayKey,
          paymentRequired: false,
          amountDueCents: 0,
          message: 'No payment is required for the direct training pathway.',
        },
        { status: 200 },
      );
    }

    const slot = await prisma.clinicianTrainingSlot.findUnique({ where: { id: slotId } });
    if (!slot) return NextResponse.json({ ok: false, error: 'training_slot_not_found' }, { status: 404 });

    if (String(slot.status || '').toLowerCase() !== 'published') {
      return NextResponse.json(
        { ok: false, error: 'training_slot_not_published' },
        { status: 409 },
      );
    }

    if (
      slot.bookingClosesAt &&
      slot.bookingClosesAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { ok: false, error: 'training_slot_booking_closed' },
        { status: 409 },
      );
    }

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

    const effectivePricing = effectiveClinicianPathwayPricing(configuredPathway);
    const pathwayTotalCents = effectivePricing.effectivePriceCents;
    const requiredNowCents = pathwayKey === 'QUALIFYING_DEPOSIT'
      ? effectivePricing.amountDueTodayCents
      : pathwayTotalCents;

    if (pathwayTotalCents <= 0 || requiredNowCents <= 0) {
      return NextResponse.json(
        { ok: false, error: 'c_med_pathway_price_not_configured', pathwayKey },
        { status: 409 },
      );
    }

    const paymentStateBefore = calculateOnboardingPaymentState({
      trainingFeeCents: pathwayTotalCents,
      minimumInitialPaymentCents: requiredNowCents,
      amountPaidCents,
    });

    const chargeAmountCents = Math.max(0, requiredNowCents - amountPaidCents);

    const pricingSnapshot = {
      pathwayKey,
      standardPriceCents: effectivePricing.standardPriceCents,
      promotionalPriceCents: effectivePricing.promotionalPriceCents,
      currentPriceCents: effectivePricing.effectivePriceCents,
      promotionStartsAt: effectivePricing.promotionStartsAt,
      promotionEndsAt: effectivePricing.promotionEndsAt,
      promotionLabel: effectivePricing.promotionLabel,
      promotionActive: effectivePricing.promotionActive,
      amountDueTodayCents: effectivePricing.amountDueTodayCents,
      capturedAt: new Date().toISOString(),
    };

    if (chargeAmountCents <= 0) {
      return NextResponse.json(
        {
          ok: true,
          paymentRequired: false,
          pathwayKey,
          reason: pathwayKey === 'QUALIFYING_DEPOSIT'
            ? 'c_med_flex_initial_requirement_already_met'
            : 'c_med_full_price_already_paid',
          paymentState: paymentStateBefore,
          pricing: pricingSnapshot,
          message: pathwayKey === 'QUALIFYING_DEPOSIT'
            ? 'The C-Med Flex amount due today has already been satisfied.'
            : 'The current C-Med Full price has already been paid.',
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
          pricingSnapshot,
          slotId,
          callbackUrl,
          clinicianEmail: email,
          settings: {
            trainingFeeCents: pathwayTotalCents,
            minimumInitialPaymentCents: requiredNowCents,
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
        pathwayPriceCents: pathwayTotalCents,
        amountDueNowCents: requiredNowCents,
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
          pricingSnapshot,
          slotId,
          callbackUrl,
          clinicianEmail: email,
          settings: {
            trainingFeeCents: pathwayTotalCents,
            minimumInitialPaymentCents: requiredNowCents,
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
        pricing: pricingSnapshot,
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
