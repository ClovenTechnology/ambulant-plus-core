import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';
import { applyMarketplaceReservationTransition } from '@/src/careport/marketplaceReservation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function normaliseProviderStatus(value: unknown) {
  const raw = clean(value, 80).toLowerCase();

  if (['success', 'successful', 'succeeded', 'paid', 'captured'].includes(raw)) return 'SUCCEEDED';
  if (['failed', 'failure', 'error', 'declined'].includes(raw)) return 'FAILED';
  if (['cancelled', 'canceled', 'abandoned'].includes(raw)) return 'CANCELLED';

  return 'REQUIRES_ACTION';
}

function providerStatusLabel(value: unknown) {
  return clean(value, 120).toUpperCase() || 'UNKNOWN';
}

function getReference(req: NextRequest, body: any) {
  const url = new URL(req.url);

  return (
    clean(body?.paymentReference, 180) ||
    clean(body?.reference, 180) ||
    clean(body?.trxref, 180) ||
    clean(url.searchParams.get('paymentReference'), 180) ||
    clean(url.searchParams.get('reference'), 180) ||
    clean(url.searchParams.get('trxref'), 180) ||
    clean(url.searchParams.get('paymentRef'), 180)
  );
}

async function resolvePatientId(userId: string) {
  if (!userId) return null;

  const profile = await (prisma as any).patientProfile
    .findUnique({
      where: { userId },
      select: { id: true },
    })
    .catch(() => null);

  return profile?.id || userId;
}

async function verifyPaystack(reference: string) {
  const secret = clean(process.env.PAYSTACK_SECRET_KEY, 500);

  if (!secret) {
    return {
      ok: false,
      statusCode: 500,
      error: 'paystack_secret_key_not_configured',
      payload: null,
    };
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      statusCode: 502,
      error: 'paystack_verification_failed',
      payload,
    };
  }

  return {
    ok: true,
    statusCode: 200,
    error: null,
    payload,
  };
}

async function verifyMarketplacePayment(
  req: NextRequest,
  ctx: { params: { orderId: string } },
  body: any,
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const orderId = clean(ctx?.params?.orderId, 120);
  const reference = getReference(req, body);

  try {
    requireRole(who, ['patient', 'admin']);

    if (!orderId) {
      return json({ ok: false, error: 'order_id_required' }, 400);
    }

    if (!reference) {
      return json({ ok: false, error: 'payment_reference_required' }, 400);
    }

    const patientId = await resolvePatientId(clean(who.uid, 120));

    const order = await (prisma as any).carePortOrder.findFirst({
      where: {
        id: orderId,
        orgId,
        erxOrderId: { startsWith: 'otc-marketplace-' },
      },
      select: {
        id: true,
        orgId: true,
        erxOrderId: true,
        patientId: true,
        status: true,
        totalCents: true,
        currency: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            amountCents: true,
            currency: true,
            provider: true,
            providerRef: true,
            idempotencyKey: true,
            metadata: true,
          },
        },
      },
    });

    if (!order) {
      return json({ ok: false, error: 'marketplace_order_not_found' }, 404);
    }

    if (who.role === 'patient' && patientId && order.patientId !== patientId && order.patientId !== who.uid) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const provider = await verifyPaystack(reference);

    if (!provider.ok) {
      return json(
        {
          ok: false,
          error: provider.error,
          provider: 'paystack',
          reference,
          providerPayload: provider.payload,
        },
        provider.statusCode,
      );
    }

    const providerPayload = provider.payload;
    const providerData = providerPayload?.data || {};
    const providerStatus = providerStatusLabel(providerData?.status);
    const status = normaliseProviderStatus(providerData?.status);
    const providerAmountCents = Number(providerData?.amount || 0);
    const providerCurrency = clean(providerData?.currency || order.currency || 'ZAR', 20).toUpperCase();

    if (
      status === 'SUCCEEDED' &&
      providerAmountCents > 0 &&
      Number(order.totalCents || 0) > 0 &&
      providerAmountCents !== Number(order.totalCents || 0)
    ) {
      return json(
        {
          ok: false,
          error: 'paystack_amount_mismatch',
          reference,
          expectedAmountCents: Number(order.totalCents || 0),
          providerAmountCents,
        },
        409,
      );
    }

    if (
      status === 'SUCCEEDED' &&
      order.currency &&
      providerCurrency &&
      providerCurrency !== String(order.currency).toUpperCase()
    ) {
      return json(
        {
          ok: false,
          error: 'paystack_currency_mismatch',
          reference,
          expectedCurrency: order.currency,
          providerCurrency,
        },
        409,
      );
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const current = await tx.carePortOrder.findFirst({
        where: {
          id: order.id,
          orgId,
          erxOrderId: { startsWith: 'otc-marketplace-' },
        },
        select: {
          id: true,
          status: true,
          totalCents: true,
          currency: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              status: true,
              providerRef: true,
              idempotencyKey: true,
              metadata: true,
            },
          },
        },
      });

      if (!current) {
        throw new Error('marketplace_order_not_found_during_payment_verify');
      }

      const existingIntent =
        current.payments.find((p: any) => p.providerRef === reference || p.idempotencyKey === reference || p.id === reference) ||
        current.payments[0] ||
        null;

      const paymentIntent = existingIntent?.id
        ? await tx.carePortPaymentIntent.update({
            where: { id: existingIntent.id },
            data: {
              status,
              provider: 'paystack',
              providerRef: reference,
              providerStatus,
              providerPayload,
              succeededAt: status === 'SUCCEEDED' ? new Date() : null,
              failedAt: ['FAILED', 'CANCELLED'].includes(status) ? new Date() : null,
              metadata: {
                ...(existingIntent.metadata && typeof existingIntent.metadata === 'object' ? existingIntent.metadata : {}),
                source: 'CAREPORT_OTC_MARKETPLACE',
                verification: 'paystack_transaction_verify',
                paymentReference: reference,
                providerStatus,
              },
            },
            select: {
              id: true,
              orderId: true,
              method: true,
              status: true,
              amountCents: true,
              currency: true,
              provider: true,
              providerRef: true,
              providerStatus: true,
            },
          })
        : await tx.carePortPaymentIntent.create({
            data: {
              orgId,
              orderId: current.id,
              method: 'CARD',
              status,
              amountCents: Number(current.totalCents || 0),
              currency: current.currency || 'ZAR',
              idempotencyKey: reference,
              provider: 'paystack',
              providerRef: reference,
              providerStatus,
              providerPayload,
              succeededAt: status === 'SUCCEEDED' ? new Date() : null,
              failedAt: ['FAILED', 'CANCELLED'].includes(status) ? new Date() : null,
              metadata: {
                source: 'CAREPORT_OTC_MARKETPLACE',
                verification: 'paystack_transaction_verify',
                paymentReference: reference,
                providerStatus,
              },
            },
            select: {
              id: true,
              orderId: true,
              method: true,
              status: true,
              amountCents: true,
              currency: true,
              provider: true,
              providerRef: true,
              providerStatus: true,
            },
          });

      let reservationTransition: any = null;
      let updatedOrder: any = {
        id: current.id,
        status: current.status,
      };

      if (status === 'SUCCEEDED' && current.status !== 'PAID') {
        reservationTransition = await applyMarketplaceReservationTransition(tx, {
          orderId: current.id,
          action: 'capture',
          reason: 'payment_verified',
          actorId: who.uid ?? null,
          actorRole: who.role ?? 'system',
        });

        updatedOrder = await tx.carePortOrder.update({
          where: { id: current.id },
          data: {
            status: 'PAID',
          },
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        });
      }

      if (
        ['FAILED', 'CANCELLED'].includes(status) &&
        !['PAID', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(current.status)
      ) {
        reservationTransition = await applyMarketplaceReservationTransition(tx, {
          orderId: current.id,
          action: 'release',
          reason: status === 'CANCELLED' ? 'payment_cancelled' : 'payment_failed',
          actorId: who.uid ?? null,
          actorRole: who.role ?? 'system',
        });

        updatedOrder = await tx.carePortOrder.update({
          where: { id: current.id },
          data: {
            status: 'CANCELLED',
          },
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          kind: 'careport_marketplace_payment_verified',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: current.id,
          meta: {
            orgId,
            orderId: current.id,
            paymentIntentId: paymentIntent.id,
            provider: 'paystack',
            providerRef: reference,
            providerStatus,
            status,
            reservationTransition,
          },
        },
      });

      return {
        order: updatedOrder,
        paymentIntent,
        reservationTransition,
      };
    });

    return json({
      ok: true,
      provider: 'paystack',
      reference,
      status,
      paid: status === 'SUCCEEDED',
      providerStatus,
      order: result.order,
      paymentIntent: result.paymentIntent,
      reservationTransition: result.reservationTransition,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || 'careport_marketplace_payment_verify_failed',
      },
      error?.status || 500,
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: { orderId: string } },
) {
  return verifyMarketplacePayment(req, ctx, {});
}

export async function POST(
  req: NextRequest,
  ctx: { params: { orderId: string } },
) {
  const body = await req.json().catch(() => ({}));
  return verifyMarketplacePayment(req, ctx, body);
}