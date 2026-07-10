import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

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

function patientAppBase(req: NextRequest) {
  const configured =
    clean(process.env.NEXT_PUBLIC_PATIENT_APP_URL, 900) ||
    clean(process.env.PATIENT_APP_BASE_URL, 900) ||
    clean(process.env.PATIENT_ORIGIN, 900);

  if (configured) return configured.replace(/\/+$/, '');

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function fallbackEmail(orderId: string) {
  return clean(process.env.PAYSTACK_FALLBACK_EMAIL, 160) || `careport-${orderId}@ambulantplus.co.za`;
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

function buildCallbackUrl(req: NextRequest, orderId: string, reference: string) {
  const base = patientAppBase(req);
  const url = new URL(`/careport/marketplace/${encodeURIComponent(orderId)}`, base);
  url.searchParams.set('paymentRef', reference);
  url.searchParams.set('paymentProvider', 'paystack');
  url.searchParams.set('reason', 'careport_marketplace_payment_callback');
  return url.toString();
}

export async function POST(
  req: NextRequest,
  ctx: { params: { orderId: string } },
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const orderId = clean(ctx?.params?.orderId, 120);

  try {
    requireRole(who, ['patient', 'admin']);

    if (!orderId) {
      return json({ ok: false, error: 'order_id_required' }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const patientId = await resolvePatientId(clean(who.uid, 120));

    const order = await (prisma as any).carePortOrder.findFirst({
      where: {
        id: orderId,
        orgId,
        status: 'PAYMENT_PENDING',
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
          take: 1,
          select: {
            id: true,
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
      return json({ ok: false, error: 'marketplace_payment_pending_order_not_found' }, 404);
    }

    if (who.role === 'patient' && patientId && order.patientId !== patientId && order.patientId !== who.uid) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const amountCents = Math.max(0, Number(order.totalCents || 0));
    if (amountCents <= 0) {
      return json({ ok: false, error: 'positive_payment_amount_required' }, 409);
    }

    const secret = clean(process.env.PAYSTACK_SECRET_KEY, 500);
    if (!secret) {
      return json({ ok: false, error: 'paystack_secret_key_not_configured' }, 500);
    }

    const existingIntent = order.payments?.[0] || null;
    const reference =
      clean(body?.paymentReference || body?.reference || existingIntent?.providerRef || existingIntent?.idempotencyKey, 180) ||
      clean(order.erxOrderId, 180);

    const email =
      clean(body?.email, 160) ||
      clean((who as any)?.email, 160) ||
      fallbackEmail(order.id);

    const callbackUrl = clean(body?.callbackUrl, 900) || buildCallbackUrl(req, order.id, reference);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountCents,
        currency: order.currency || 'ZAR',
        reference,
        callback_url: callbackUrl,
        metadata: {
          source: 'CAREPORT_OTC_MARKETPLACE',
          orderId: order.id,
          erxOrderId: order.erxOrderId,
          paymentIntentId: existingIntent?.id || null,
          patientId: order.patientId,
        },
      }),
    });

    const paystackPayload = await paystackRes.json().catch(() => ({}));
    const authorizationUrl = clean(paystackPayload?.data?.authorization_url, 1200);
    const accessCode = clean(paystackPayload?.data?.access_code, 300);

    if (!paystackRes.ok || !authorizationUrl) {
      return json(
        {
          ok: false,
          error: 'paystack_initialization_failed',
          providerStatus: paystackPayload?.status ?? null,
          providerMessage: paystackPayload?.message ?? null,
        },
        502,
      );
    }

    const paymentIntent = existingIntent?.id
      ? await (prisma as any).carePortPaymentIntent.update({
          where: { id: existingIntent.id },
          data: {
            status: 'REQUIRES_ACTION',
            provider: 'paystack',
            providerRef: reference,
            providerStatus: 'PENDING_REDIRECT',
            providerPayload: paystackPayload,
            metadata: {
              ...(existingIntent.metadata && typeof existingIntent.metadata === 'object' ? existingIntent.metadata : {}),
              source: 'CAREPORT_OTC_MARKETPLACE',
              checkout: 'patient_pharmacy',
              paymentReference: reference,
              callbackUrl,
              accessCode,
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
      : await (prisma as any).carePortPaymentIntent.create({
          data: {
            orgId,
            orderId: order.id,
            method: 'CARD',
            status: 'REQUIRES_ACTION',
            amountCents,
            currency: order.currency || 'ZAR',
            idempotencyKey: reference,
            provider: 'paystack',
            providerRef: reference,
            providerStatus: 'PENDING_REDIRECT',
            providerPayload: paystackPayload,
            metadata: {
              source: 'CAREPORT_OTC_MARKETPLACE',
              checkout: 'patient_pharmacy',
              paymentReference: reference,
              callbackUrl,
              accessCode,
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

    await (prisma as any).auditEvent
      .create({
        data: {
          kind: 'careport_marketplace_payment_initiated',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: order.id,
          meta: {
            orgId,
            orderId: order.id,
            paymentIntentId: paymentIntent.id,
            provider: 'paystack',
            providerRef: reference,
            amountCents,
            currency: order.currency || 'ZAR',
          },
        },
      })
      .catch(() => null);

    return json({
      ok: true,
      orderId: order.id,
      paymentIntent,
      paymentReference: reference,
      reference,
      provider: 'paystack',
      authorizationUrl,
      redirectUrl: authorizationUrl,
      callbackUrl,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || 'careport_marketplace_payment_init_failed',
      },
      error?.status || 500,
    );
  }
}