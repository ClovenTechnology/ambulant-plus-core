import { NextRequest, NextResponse } from 'next/server';
import { verifyCheckout } from '@/src/payments/checkout-core';
import { syncVerifiedPaymentToAppointment } from '@/src/payments/payment-sync';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


async function reconcileCarePortPayment(reference: string, verified: any) {
  const intent = await (prisma as any).carePortPaymentIntent?.findFirst?.({
    where: {
      OR: [
        { providerRef: reference },
        { idempotencyKey: reference },
        { id: reference },
      ],
    },
    include: { order: true },
  });

  if (!intent?.order) return null;

  const status = verified.status === 'captured' ? 'SUCCEEDED' : verified.status === 'pending' ? 'PENDING' : 'FAILED';

  const updatedIntent = await (prisma as any).carePortPaymentIntent.update({
    where: { id: intent.id },
    data: {
      status,
      providerStatus: status,
      providerRef: reference,
      providerPayload: verified.raw ?? null,
      paidAt: status === 'SUCCEEDED' ? new Date() : intent.paidAt ?? null,
      failedAt: status === 'FAILED' ? new Date() : intent.failedAt ?? null,
      failureReason: status === 'FAILED' ? 'provider_verification_failed' : null,
    },
  });

  if (status === 'SUCCEEDED' && intent.order.status !== 'PAID') {
    await prisma.carePortOrder.update({
      where: { id: intent.order.id },
      data: {
        status: 'PAID',
        settlementStatus: (intent.order as any).settlementStatus || 'UNSETTLED',
      } as any,
    });
  }

  await prisma.auditEvent.create({
    data: {
      kind: 'careport_payment_verified',
      actorId: null,
      actorRole: 'system',
      subjectId: intent.order.id,
      meta: {
        provider: 'paystack',
        reference,
        paymentIntentId: intent.id,
        status,
      },
    },
  }).catch(() => null);

  return {
    orderId: intent.order.id,
    paymentIntent: updatedIntent,
    redirect:
      status === 'SUCCEEDED'
        ? `/careport/marketplace/${encodeURIComponent(intent.order.id)}?payment=success`
        : `/careport/marketplace/${encodeURIComponent(intent.order.id)}?payment=${encodeURIComponent(String(verified.status || 'failed'))}`,
  };
}


export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const reference =
      url.searchParams.get('reference') ||
      url.searchParams.get('trxref') ||
      url.searchParams.get('paymentRef') ||
      '';

    if (!reference.trim()) {
      return NextResponse.json({ ok: false, error: 'reference_required' }, { status: 400 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { paymentRef: reference.trim() },
    });

    function payableAmountMinor(appointment: any) {
  const copay = Number(appointment?.patientCopayMinor ?? 0);
  const price = Number(appointment?.priceCents ?? appointment?.amountMinor ?? appointment?.totalMinor ?? 0);

  if (Number.isFinite(copay) && copay > 0) return Math.round(copay);
  if (Number.isFinite(price) && price > 0) return Math.round(price);

  return 0;
}

const expectedAmountCents = payableAmountMinor(appointment);
const expectedCurrency = appointment?.currency ?? 'ZAR';

    const verified = await verifyCheckout({
      provider: 'paystack',
      reference: reference.trim(),
      expectedAmountCents,
      expectedCurrency,
    });

    const carePort = await reconcileCarePortPayment(reference.trim(), verified);
    if (carePort) {
      return NextResponse.json(
        {
          ok: true,
          verification: verified,
          carePortOrderId: carePort.orderId,
          paymentIntent: carePort.paymentIntent,
          redirect: carePort.redirect,
        },
        { status: 200 },
      );
    }

    const synced = await syncVerifiedPaymentToAppointment({
      reference: reference.trim(),
      provider: 'paystack',
      state: verified.status,
      amountCents: verified.amountCents,
      currency: verified.currency,
      raw: (verified.raw as Record<string, unknown>) || null,
    });

    return NextResponse.json(
      {
        ok: true,
        verification: verified,
        appointmentId: synced.appointment?.id ?? null,
        paymentId: synced.payment.id,
        redirect:
          verified.status === 'captured'
            ? `/appointments/${encodeURIComponent(synced.appointment?.id || '')}?payment=success`
            : `/appointments/${encodeURIComponent(synced.appointment?.id || '')}?payment=${encodeURIComponent(verified.status)}`,
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'payment_verify_failed' },
      { status: 400 },
    );
  }
}