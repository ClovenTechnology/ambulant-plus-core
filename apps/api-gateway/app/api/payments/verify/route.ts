import { NextRequest, NextResponse } from 'next/server';
import { verifyCheckout } from '@/src/payments/checkout-core';
import {
  resolvePaymentReference,
  syncVerifiedPaymentToAppointment,
} from '@/src/payments/payment-sync';
import { prisma } from '@/src/lib/db';
import { applyMarketplaceReservationTransition } from '@/src/careport/marketplaceReservation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


function carePortPaymentStatus(verified: any) {
  const raw = String(verified?.status || '').toLowerCase();

  if (['captured', 'success', 'succeeded', 'paid'].includes(raw)) return 'SUCCEEDED';
  if (['pending', 'requires_action', 'requires-action', 'processing'].includes(raw)) return 'REQUIRES_ACTION';
  if (['cancelled', 'canceled'].includes(raw)) return 'CANCELLED';

  return 'FAILED';
}

async function reconcileCarePortPayment(reference: string, verified: any) {
  const result = await (prisma as any).$transaction(
    async (tx: any) => {
      const intent = await tx.carePortPaymentIntent.findFirst({
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

      const status = carePortPaymentStatus(verified);
      const now = new Date();

      const updatedIntent = await tx.carePortPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status,
          providerStatus: status,
          providerRef: reference,
          providerPayload: verified.raw ?? null,
          paidAt: status === 'SUCCEEDED' ? now : intent.paidAt ?? null,
          failedAt: ['FAILED', 'CANCELLED'].includes(status) ? now : intent.failedAt ?? null,
          failureReason:
            status === 'FAILED'
              ? 'provider_verification_failed'
              : status === 'CANCELLED'
                ? 'provider_payment_cancelled'
                : null,
        },
      });

      let orderStatus = intent.order.status;
      let reservationTransition: any = null;

      if (status === 'SUCCEEDED' && intent.order.status !== 'PAID') {
        const updatedOrder = await tx.carePortOrder.update({
          where: { id: intent.order.id },
          data: {
            status: 'PAID',
            settlementStatus: (intent.order as any).settlementStatus || 'UNSETTLED',
          } as any,
        });

        orderStatus = updatedOrder.status;
      }

      if (
        ['FAILED', 'CANCELLED'].includes(status) &&
        !['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(intent.order.status)
      ) {
        reservationTransition = await applyMarketplaceReservationTransition(tx, {
          orderId: intent.order.id,
          action: 'release',
          reason: status === 'CANCELLED' ? 'payment_cancelled' : 'payment_failed',
          actorId: null,
          actorRole: 'system',
        });

        const updatedOrder = await tx.carePortOrder.update({
          where: { id: intent.order.id },
          data: {
            status: 'CANCELLED',
          } as any,
        });

        orderStatus = updatedOrder.status;
      }

      await tx.auditEvent.create({
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
            orderStatus,
            reservationTransition,
          },
        },
      }).catch(() => null);

      return {
        orderId: intent.order.id,
        paymentIntent: updatedIntent,
        orderStatus,
        marketplaceReservation: reservationTransition,
        redirect:
          status === 'SUCCEEDED'
            ? `/careport/marketplace/${encodeURIComponent(intent.order.id)}?payment=success`
            : `/careport/marketplace/${encodeURIComponent(intent.order.id)}?payment=${encodeURIComponent(String(verified.status || 'failed'))}`,
      };
    },
    {
      isolationLevel: 'Serializable' as any,
      maxWait: 10000,
      timeout: 30000,
    },
  );

  return result;
}
function patientAppBaseUrl() {
  return (
    process.env.PATIENT_APP_URL?.trim() ||
    process.env.PATIENT_APP_ORIGIN?.trim() ||
    'https://patient.ambulantplus.co.za'
  );
}

function wantsJsonResponse(req: NextRequest, url: URL) {
  const format = String(url.searchParams.get('format') || '').toLowerCase();
  if (format === 'json') return true;

  const accept = String(req.headers.get('accept') || '').toLowerCase();
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;

  return String(req.headers.get('x-requested-with') || '').toLowerCase() === 'xmlhttprequest';
}

function absolutePatientUrl(path: string) {
  return new URL(path || '/appointments', patientAppBaseUrl());
}

function payableAmountMinor(appointment: any) {
  const copay = Number(appointment?.patientCopayMinor ?? 0);
  const price = Number(appointment?.priceCents ?? appointment?.amountMinor ?? appointment?.totalMinor ?? 0);

  if (Number.isFinite(copay) && copay > 0) return Math.round(copay);
  if (Number.isFinite(price) && price > 0) return Math.round(price);

  return 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  try {
    const reference =
      url.searchParams.get('reference') ||
      url.searchParams.get('trxref') ||
      url.searchParams.get('paymentRef') ||
      '';

    if (!reference.trim()) {
      if (!wantsJsonResponse(req, url)) {
        return NextResponse.redirect(
          absolutePatientUrl('/appointments?payment=failed&error=reference_required'),
          303,
        );
      }

      return NextResponse.json({ ok: false, error: 'reference_required' }, { status: 400 });
    }

    const cleanReference = reference.trim();
    const resolved = await resolvePaymentReference(cleanReference);
    const appointment = resolved.appointment;

    const verified = await verifyCheckout({
      provider: 'paystack',
      reference: cleanReference,
      expectedAmountCents: appointment ? payableAmountMinor(appointment) : 0,
      expectedCurrency: appointment?.currency ?? 'ZAR',
    });

    const carePort = await reconcileCarePortPayment(cleanReference, verified);
    if (carePort) {
      const body = {
        ok: true,
        verification: verified,
        carePortOrderId: carePort.orderId,
        paymentIntent: carePort.paymentIntent,
        redirect: carePort.redirect,
      };

      if (!wantsJsonResponse(req, url)) {
        return NextResponse.redirect(absolutePatientUrl(carePort.redirect), 303);
      }

      return NextResponse.json(body, { status: 200 });
    }

    const synced = await syncVerifiedPaymentToAppointment({
      reference: cleanReference,
      provider: 'paystack',
      state: verified.status,
      amountCents: verified.amountCents,
      currency: verified.currency,
      raw: (verified.raw as Record<string, unknown>) || null,
    });

    const appointmentId = synced.appointment?.id ?? appointment?.id ?? null;

    const paymentState =
      verified.status === 'captured'
        ? 'success'
        : verified.status === 'pending'
          ? 'pending'
          : 'failed';

    const redirectPath = appointmentId
      ? `/appointments/${encodeURIComponent(appointmentId)}?payment=${encodeURIComponent(paymentState)}`
      : `/appointments?payment=${encodeURIComponent(paymentState)}`;

    const body = {
      ok: true,
      verification: verified,
      appointmentId,
      paymentId: synced.payment.id,
      redirect: redirectPath,
    };

    if (!wantsJsonResponse(req, url)) {
      return NextResponse.redirect(absolutePatientUrl(redirectPath), 303);
    }

    return NextResponse.json(body, { status: 200 });
  } catch (e: any) {
    const error = String(e?.message || 'payment_verify_failed');

    if (!wantsJsonResponse(req, url)) {
      return NextResponse.redirect(
        absolutePatientUrl(`/appointments?payment=failed&error=${encodeURIComponent(error)}`),
        303,
      );
    }

    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}
