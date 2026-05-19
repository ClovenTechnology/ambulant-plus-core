// apps/api-gateway/app/api/payments/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';
import { beginCheckout, verifyCheckout } from '@/src/payments/checkout-core';
import { syncVerifiedPaymentToAppointment } from '@/src/payments/payment-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function paymentStatusFromCheckout(status: string) {
  if (status === 'authorized') return 'captured';
  if (status === 'pending_redirect' || status === 'pending_review') return 'pending';
  return 'failed';
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    if (who.role !== 'patient' && who.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const b = await req.json().catch(() => ({} as any));
    const action = String(b.action || 'initialize').toLowerCase();

    if (action === 'verify') {
      const paymentRef = String(b.paymentRef || b.reference || '').trim();
      if (!paymentRef) {
        return NextResponse.json({ ok: false, error: 'paymentRef required' }, { status: 400 });
      }

      const payment = await prisma.payment.findFirst({
        where: { OR: [{ id: paymentRef }, { providerRef: paymentRef }] },
      });

      if (!payment) {
        return NextResponse.json({ ok: false, error: 'payment_not_found' }, { status: 404 });
      }

      const meta = readMeta(payment.meta);
      const providerName = String(meta.provider || 'paystack') as 'paystack' | 'payfast' | 'mock';
      const providerRef = payment.providerRef || paymentRef;

      const verified = await verifyCheckout({
        provider: providerName === 'payfast' ? 'payfast' : providerName === 'mock' ? 'mock' : 'paystack',
        reference: providerRef,
        expectedAmountCents: payment.amountCents,
        expectedCurrency: payment.currency,
      });

      const nextStatus =
        verified.status === 'captured'
          ? 'captured'
          : verified.status === 'pending'
            ? 'pending'
            : 'failed';

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          meta: jsonSafe({
            ...meta,
            verification: verified.raw || null,
            verifiedAt: new Date().toISOString(),
          }),
        },
      });

      let syncedAppointmentId: string | null = null;

      try {
        const synced = await syncVerifiedPaymentToAppointment({
          reference: providerRef,
          provider:
            providerName === 'payfast'
              ? 'payfast'
              : providerName === 'mock'
                ? 'mock'
                : 'paystack',
          state:
            nextStatus === 'captured'
              ? 'captured'
              : nextStatus === 'pending'
                ? 'pending'
                : 'failed',
          amountCents: verified.amountCents ?? payment.amountCents,
          currency: verified.currency ?? payment.currency,
          raw: (verified.raw as Record<string, unknown>) || null,
        });

        syncedAppointmentId = synced.appointment?.id ?? null;
      } catch {
        // keep payment verification response alive; appointment sync is best-effort here
      }

      if (nextStatus === 'captured') {
        try {
          emitEvent({
            kind: 'payment_captured',
            encounterId: payment.encounterId,
            patientId: b.patientId || who.uid || null,
            clinicianId: b.clinicianId || null,
            payload: { paymentId: updated.id, amount: updated.amountCents },
          } as any);
        } catch {
          // best-effort runtime event
        }
      }

      return NextResponse.json(
        { ok: true, payment: updated, appointmentId: syncedAppointmentId },
        { status: 200 },
      );
    }

    const amountCents = Math.max(0, Math.round(Number(b.amountCents ?? 0)));
    const currency = String(b.currency || 'ZAR').toUpperCase();
    const encounterId = b.encounterId ?? null;
    const appointmentId = String(b.appointmentId || '').trim();
    const paymentMethod = String(b.paymentMethod || 'CARD').toUpperCase() as
      | 'CARD'
      | 'MEDICAL_AID'
      | 'VOUCHER';

    if (!appointmentId) {
      return NextResponse.json({ ok: false, error: 'appointmentId required' }, { status: 400 });
    }

    const checkout = await beginCheckout({
      method: paymentMethod,
      appointmentId,
      amountCents,
      currency,
      email: b.email || null,
      callbackUrl: b.callbackUrl || null,
      metadata: b.meta || {},
    });

    const payment = await prisma.payment.create({
      data: {
        id: randomId('pay'),
        encounterId,
        caseId: b.caseId ?? null,
        amountCents,
        currency,
        status: paymentStatusFromCheckout(checkout.status),
        providerRef: checkout.reference,
        meta: jsonSafe({
          ...(b.meta ?? {}),
          provider: checkout.provider === 'internal' ? 'mock' : checkout.provider,
          paymentMethod,
          redirectUrl: checkout.redirectUrl,
          checkout: checkout.raw ?? null,
        }),
      } as any,
    });

    await prisma.auditEvent.create({
      data: {
        kind: 'payment_initiated',
        actorId: who.uid,
        actorRole: who.role,
        subjectId: payment.id,
        meta: jsonSafe({
          appointmentId,
          encounterId,
          amountCents,
          currency,
          providerRef: checkout.reference,
          paymentMethod,
        }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        payment,
        redirectUrl: checkout.redirectUrl,
        providerRef: checkout.reference,
        status: checkout.status,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('[api-gateway][payments] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'payment_failed') },
      { status: 500 },
    );
  }
}