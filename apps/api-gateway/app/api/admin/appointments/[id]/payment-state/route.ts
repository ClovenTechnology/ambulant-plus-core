import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canView(role: unknown) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'admin_staff' || r === 'system';
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function safePaymentAction(args: {
  appointment: any;
  payment: any | null;
}) {
  const appt = args.appointment;
  const payment = args.payment;

  const status = String(appt?.status || '').toLowerCase();
  const paymentStatus = String(appt?.paymentStatus || '').toUpperCase();
  const providerRef = String(appt?.paymentRef || payment?.providerRef || '').trim();

  if (paymentStatus === 'CAPTURED' || paymentStatus === 'PAID' || paymentStatus === 'SETTLED') {
    return {
      state: 'ready',
      nextAction: 'Clinical flow may proceed.',
      blockers: [],
    };
  }

  if (!providerRef && status === 'payment_init_failed') {
    return {
      state: 'checkout_init_failed',
      nextAction: 'Ask patient to rebook or restart checkout.',
      blockers: ['payment_checkout_not_started'],
    };
  }

  if (paymentStatus === 'FAILED') {
    return {
      state: 'failed',
      nextAction: 'Do not start consultation. Ask patient to retry payment or admin to cancel/rebook.',
      blockers: ['payment_failed'],
    };
  }

  if (paymentStatus === 'PENDING' || status === 'pending_payment') {
    return {
      state: 'pending',
      nextAction: providerRef
        ? 'Verify provider reference or wait for webhook.'
        : 'Payment is pending but no provider reference is attached.',
      blockers: providerRef ? ['payment_pending'] : ['missing_payment_reference'],
    };
  }

  if (paymentStatus === 'NOT_REQUIRED') {
    return {
      state: 'not_required',
      nextAction: 'Clinical flow may proceed if booking policy allows.',
      blockers: [],
    };
  }

  return {
    state: 'unknown',
    nextAction: 'Review appointment/payment records manually.',
    blockers: ['unknown_payment_state'],
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ident = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, ident);

    if (!ident?.uid || !canView(ident.role)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const appointmentId = String(params?.id || '').trim();
    if (!appointmentId) {
      return NextResponse.json({ ok: false, error: 'appointment_id_required' }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return NextResponse.json({ ok: false, error: 'appointment_not_found' }, { status: 404 });
    }

    const paymentRef = String((appointment as any).paymentRef || '').trim();

    const payment = paymentRef
      ? await prisma.payment.findFirst({
          where: {
            OR: [
              { providerRef: paymentRef },
              { id: paymentRef },
              { encounterId: (appointment as any).encounterId },
            ],
          },
          orderBy: { updatedAt: 'desc' },
        })
      : await prisma.payment.findFirst({
          where: { encounterId: (appointment as any).encounterId },
          orderBy: { updatedAt: 'desc' },
        });

    const audits = await prisma.appointmentAuditEvent
      .findMany({
        where: { appointmentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      .catch(() => []);

    const appointmentMeta = readMeta((appointment as any).meta);
    const paymentMeta = payment ? readMeta((payment as any).meta) : {};

    const action = safePaymentAction({ appointment, payment });

    return NextResponse.json(
      {
        ok: true,
        appointmentId,
        appointment: {
          id: appointment.id,
          status: (appointment as any).status,
          paymentStatus: (appointment as any).paymentStatus,
          paymentMethod: (appointment as any).paymentMethod,
          paymentProvider: (appointment as any).paymentProvider,
          paymentRef: (appointment as any).paymentRef,
          priceCents: (appointment as any).priceCents,
          currency: (appointment as any).currency,
          patientCopayMinor: (appointment as any).patientCopayMinor,
          sponsorAmountMinor: (appointment as any).sponsorAmountMinor,
          coverageDecision: (appointment as any).coverageDecision,
          startsAt: (appointment as any).startsAt,
          endsAt: (appointment as any).endsAt,
          createdAt: (appointment as any).createdAt,
          updatedAt: (appointment as any).updatedAt,
        },
        payment: payment
          ? {
              id: payment.id,
              status: (payment as any).status,
              providerRef: (payment as any).providerRef,
              amountCents: (payment as any).amountCents,
              currency: (payment as any).currency,
              encounterId: (payment as any).encounterId,
              createdAt: (payment as any).createdAt,
              updatedAt: (payment as any).updatedAt,
              provider: paymentMeta.provider ?? null,
              verifiedAt: paymentMeta.verifiedAt ?? null,
              verification: paymentMeta.verification ?? null,
            }
          : null,
        verification: appointmentMeta.paymentVerification ?? paymentMeta.verification ?? null,
        action,
        auditEvents: audits.map((a: any) => ({
          id: a.id,
          action: a.action,
          actorType: a.actorType,
          actorUserId: a.actorUserId,
          reason: a.reason,
          createdAt: a.createdAt,
          beforeJson: a.beforeJson,
          afterJson: a.afterJson,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const msg = String(err?.message || 'payment_state_failed');

    if (msg === 'unauthorized' || msg === 'Unauthorized') {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    console.error('[admin.appointments.payment-state] failed', { message: msg });

    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}