// apps/api-gateway/app/api/clinicians/onboarding/payment/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getProvider } from '@/src/payments';
import { finaliseClinicianTrainingPayment } from '@/src/clinicians/onboarding/finalise-training-payment';
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

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const paymentId = cleanStr(body.paymentId, 120);
    const reference = cleanStr(body.providerReference || body.reference || body.paymentRef, 160);

    if (!paymentId && !reference) {
      return NextResponse.json({ ok: false, error: 'paymentId_or_reference_required' }, { status: 400 });
    }

    const payment = paymentId
      ? await prisma.clinicianOnboardingPayment.findUnique({ where: { id: paymentId } })
      : await prisma.clinicianOnboardingPayment.findUnique({ where: { providerReference: reference as string } });

    if (!payment) return NextResponse.json({ ok: false, error: 'payment_not_found' }, { status: 404 });

    const identity =
      await resolveAuthenticatedClinician(
        req,
        String(payment.clinicianId),
      );

    if (!identity.ok) {
      return identity.response;
    }

    if (payment.provider !== 'paystack') {
      return NextResponse.json({ ok: false, error: 'payment_provider_not_paystack' }, { status: 409 });
    }

    const providerRef = cleanStr(payment.providerReference || reference, 160);
    if (!providerRef) return NextResponse.json({ ok: false, error: 'providerReference_missing' }, { status: 400 });

    const provider = getProvider('paystack');
    const verified = await provider.verifyCheckout(providerRef);

    const amountMismatch =
      verified.status === 'captured' &&
      typeof verified.amountCents === 'number' &&
      Number(verified.amountCents) !== Number(payment.amountCents);

    const currencyMismatch =
      verified.status === 'captured' &&
      verified.currency &&
      String(verified.currency).toUpperCase() !== String(payment.currency).toUpperCase();

    const nextStatus =
      amountMismatch || currencyMismatch
        ? 'failed'
        : verified.status === 'captured'
          ? 'captured'
          : verified.status === 'pending'
            ? 'pending'
            : 'failed';

    const meta = readMeta(payment.meta);
    const updated = await prisma.clinicianOnboardingPayment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        meta: jsonSafe({
          ...meta,
          verification: verified.raw ?? null,
          verifiedAt: new Date().toISOString(),
          amountMismatch,
          currencyMismatch,
        }),
      },
    });

    if (nextStatus !== 'captured') {
      return NextResponse.json(
        {
          ok: true,
          captured: false,
          payment: {
            id: updated.id,
            status: updated.status,
            provider: updated.provider,
            providerReference: updated.providerReference,
          },
          verification: {
            status: verified.status,
            amountMismatch,
            currencyMismatch,
          },
        },
        { status: 200 },
      );
    }

    const slotId = cleanStr(meta.slotId || body.slotId || body.trainingSlotId, 120);
    if (!slotId) {
      return NextResponse.json({ ok: false, error: 'slotId_missing_from_payment_meta' }, { status: 409 });
    }

    const finalised = await finaliseClinicianTrainingPayment({
      clinicianId: updated.clinicianId,
      onboardingId: updated.onboardingId,
      slotId,
      paymentId: updated.id,
      method: 'paystack',
      notes: 'Paystack payment verified and captured.',
    });

    return NextResponse.json(
      {
        ...finalised.body,
        payment: {
          id: updated.id,
          status: 'captured',
          provider: updated.provider,
          providerReference: updated.providerReference,
        },
      },
      { status: finalised.status },
    );
  } catch (err: any) {
    console.error('[clinician-training-payment-verify] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'payment_verify_failed' }, { status: 500 });
  }
}
