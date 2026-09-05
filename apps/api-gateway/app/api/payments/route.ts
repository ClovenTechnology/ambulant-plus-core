// apps/api-gateway/app/api/payments/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  beginCheckout,
  verifyCheckout,
} from '@/src/payments/checkout-core';
import {
  resolvePaymentReference,
  syncVerifiedPaymentToAppointment,
} from '@/src/payments/payment-sync';
import {
  bookingStateForAppointment,
  cancelBookingIntent,
  expireBookingIntent,
  loadBookingIntentForAppointment,
  reconcileCoverageAuthorization,
} from '@/src/appointments/booking-reservation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value ?? null),
  ) as Prisma.InputJsonValue;
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}


const PROVIDER_REDIRECT_REPLAY_MAX_AGE_MS = 10 * 60_000;

function appointmentPaymentWindowClosed(appointment: any) {
  const startsAt = Date.parse(clean(appointment?.startsAt, 120));
  return Number.isFinite(startsAt) && startsAt <= Date.now();
}

function sha256Hex(value: string) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function normalizeIdempotencyKey(req: NextRequest) {
  const value = clean(
    req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key'),
    180,
  );

  if (!value) {
    throw Object.assign(
      new Error('idempotency_key_required'),
      { status: 428 },
    );
  }

  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(value)) {
    throw Object.assign(
      new Error('invalid_idempotency_key'),
      { status: 400 },
    );
  }

  return value;
}

function paymentStatusFromCheckout(status: string) {
  if (status === 'authorized') return 'captured';
  if (
    status === 'pending_redirect' ||
    status === 'pending_review'
  ) {
    return 'pending';
  }
  return 'failed';
}

type StoredPaymentProvider =
  | 'paystack'
  | 'payfast'
  | 'mock'
  | 'internal';

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function cleanPaymentProvider(
  value: unknown,
): StoredPaymentProvider {
  const provider = clean(value, 40).toLowerCase();
  if (provider === 'payfast') return 'payfast';
  if (provider === 'paystack') return 'paystack';
  if (provider === 'internal') return 'internal';
  if (provider === 'mock') return 'mock';
  return 'paystack';
}

function isInternalProviderReference(
  provider: StoredPaymentProvider,
  reference: string | null | undefined,
) {
  const value = clean(reference, 200);
  return (
    provider === 'internal' ||
    (
      provider === 'mock' &&
      /^(zero|voucher|medicalaid)_/.test(value)
    )
  );
}

function externalProviderOrNull(
  provider: StoredPaymentProvider,
) {
  if (provider === 'payfast') return 'payfast' as const;
  if (provider === 'paystack') return 'paystack' as const;
  if (provider === 'mock' && !isProductionRuntime()) {
    return 'mock' as const;
  }
  return null;
}

function patientAppOrigin() {
  const configured = clean(
    process.env.PATIENT_APP_ORIGIN ||
      process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN ||
      'https://patient.ambulantplus.co.za',
    500,
  );

  try {
    return new URL(configured).origin;
  } catch {
    return 'https://patient.ambulantplus.co.za';
  }
}

function safeCallbackUrl(value: unknown) {
  const allowedOrigin = patientAppOrigin();
  const fallback =
    `${allowedOrigin}/appointments?payment=return`;

  const candidate = clean(value, 2000);
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    return url.origin === allowedOrigin
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

function appointmentAmountCents(appointment: any) {
  const candidates = [
    appointment?.patientCopayMinor,
    appointment?.totalMinor,
    appointment?.amountMinor,
    appointment?.priceCents,
  ];

  for (const candidate of candidates) {
    const amount = Number(candidate);
    if (Number.isFinite(amount) && amount >= 0) {
      return Math.round(amount);
    }
  }

  throw Object.assign(
    new Error('appointment_amount_unavailable'),
    { status: 409 },
  );
}

function appointmentCurrency(appointment: any) {
  const currency = clean(
    appointment?.currency ||
      appointment?.sponsorCurrency ||
      'ZAR',
    3,
  ).toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw Object.assign(
      new Error('appointment_currency_invalid'),
      { status: 409 },
    );
  }

  return currency;
}

async function loadAppointmentForPayment(
  appointmentId: string,
) {
  const appointment =
    await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        careRecipients: {
          select: {
            patientId: true,
          },
        },
      },
    });

  if (!appointment) {
    throw Object.assign(
      new Error('appointment_not_found'),
      { status: 404 },
    );
  }

  return appointment as any;
}

function appointmentAccessible(
  appointment: any,
  who: ReturnType<typeof readIdentity>,
) {
  if (
    who.role === 'admin' ||
    who.role === 'admin_staff' ||
    who.role === 'system'
  ) {
    return true;
  }

  if (who.role !== 'patient' || !who.uid) return false;

  const actorPatientId = clean(who.actorRefId);
  const authorizedPatientIds = new Set(
    [
      appointment.patientId,
      appointment.subjectPatientId,
      ...(Array.isArray(appointment.careRecipients)
        ? appointment.careRecipients.map(
            (recipient: any) => recipient.patientId,
          )
        : []),
    ]
      .map((value) => clean(value))
      .filter(Boolean),
  );

  return (
    clean(appointment.hostUserId) === clean(who.uid) ||
    (
      Boolean(actorPatientId) &&
      authorizedPatientIds.has(actorPatientId)
    )
  );
}

function assertAppointmentAccessible(
  appointment: any,
  who: ReturnType<typeof readIdentity>,
) {
  if (!appointmentAccessible(appointment, who)) {
    throw Object.assign(
      new Error('payment_appointment_forbidden'),
      { status: 403 },
    );
  }
}

async function existingPaymentRecord(
  appointment: any,
) {
  const paymentIntentId = clean(
    appointment.paymentIntentId,
    160,
  );
  const paymentRef = clean(
    appointment.paymentRef,
    160,
  );

  return paymentIntentId &&
    !paymentIntentId.startsWith('init-')
    ? prisma.payment.findUnique({
        where: { id: paymentIntentId },
      })
    : paymentRef
      ? prisma.payment.findFirst({
          where: { providerRef: paymentRef },
        })
      : null;
}

function providerRedirectReplayIsStale(
  payment: any,
  appointment: any,
) {
  const paymentStatus = clean(payment?.status, 40).toLowerCase();
  if (!['pending', 'pending_redirect', 'processing'].includes(paymentStatus)) {
    return false;
  }

  const paymentMeta = readMeta(payment?.meta);
  const appointmentMeta = readMeta(appointment?.meta);
  const initialization = readMeta(appointmentMeta.paymentInitialization);
  const initializedAt = Date.parse(
    clean(
      paymentMeta.initializedAt ||
        initialization.initializedAt ||
        initialization.reservedAt,
      120,
    ),
  );

  return (
    Number.isFinite(initializedAt) &&
    Date.now() - initializedAt > PROVIDER_REDIRECT_REPLAY_MAX_AGE_MS
  );
}

async function releaseStaleProviderPaymentPointer(
  appointment: any,
) {
  const payment = await existingPaymentRecord(appointment);
  if (!payment || !providerRedirectReplayIsStale(payment, appointment)) {
    return appointment;
  }

  const paymentIntentId = clean(appointment.paymentIntentId, 160);
  const paymentRef = clean(appointment.paymentRef, 160);
  const paymentMeta = readMeta(payment.meta);
  const appointmentMeta = readMeta(appointment.meta);
  const initialization = readMeta(appointmentMeta.paymentInitialization);
  const bookingPaymentAttemptId = clean(
    paymentMeta.bookingPaymentAttemptId,
    160,
  );
  const releasedAt = new Date();

  const where: Record<string, any> = { id: appointment.id };
  if (paymentIntentId && !paymentIntentId.startsWith('init-')) {
    where.paymentIntentId = paymentIntentId;
  } else if (paymentRef) {
    where.paymentRef = paymentRef;
  } else {
    return appointment;
  }

  await prisma.$transaction(async (tx: any) => {
    const released = await tx.appointment.updateMany({
      where,
      data: {
        paymentIntentId: null,
        paymentRef: null,
        meta: jsonSafe({
          ...appointmentMeta,
          paymentInitialization: {
            ...initialization,
            state: 'PROVIDER_SESSION_STALE_RELEASED',
            releasedAt: releasedAt.toISOString(),
            previousPaymentId: payment.id,
            previousProviderRef: payment.providerRef || null,
          },
        }),
      },
    });

    if (released.count !== 1) return;

    if (bookingPaymentAttemptId) {
      await tx.bookingPaymentAttempt.updateMany({
        where: {
          id: bookingPaymentAttemptId,
          status: { in: ['CREATED', 'PENDING_REDIRECT', 'PROCESSING'] },
        },
        data: {
          status: 'EXPIRED',
          cancelledAt: releasedAt,
          failureCode: 'provider_session_stale',
        },
      });
    }

    await tx.payment.updateMany({
      where: { id: payment.id },
      data: {
        meta: jsonSafe({
          ...paymentMeta,
          supersededAt: releasedAt.toISOString(),
          supersededReason: 'provider_session_stale',
        }),
      },
    });
  });

  return loadAppointmentForPayment(appointment.id);
}

async function existingPaymentResponse(
  appointment: any,
) {
  const payment = await existingPaymentRecord(appointment);

  if (!payment) return null;

  const paymentStatus = clean(payment.status, 40).toLowerCase();
  if (!['captured', 'authorized', 'pending', 'pending_redirect', 'pending_review', 'processing'].includes(paymentStatus)) {
    return null;
  }

  if (providerRedirectReplayIsStale(payment, appointment)) {
    return null;
  }

  const meta = readMeta(payment.meta);
  return {
    ok: true,
    idempotentReplay: true,
    payment,
    redirectUrl: meta.redirectUrl || null,
    providerRef: payment.providerRef || null,
    status: payment.status,
  };
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);

    if (
      who.role !== 'patient' &&
      who.role !== 'admin' &&
      who.role !== 'admin_staff' &&
      who.role !== 'system'
    ) {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      );
    }

    const body =
      await req.json().catch(() => ({} as any));
    const action =
      clean(body.action || 'initialize', 40).toLowerCase();

    if (action === 'verify') {
      const paymentRef = clean(
        body.paymentRef || body.reference,
        160,
      );

      if (!paymentRef) {
        return NextResponse.json(
          { ok: false, error: 'paymentRef_required' },
          { status: 400 },
        );
      }

      const resolved =
        await resolvePaymentReference(paymentRef);
      const payment = resolved.payment;

      if (!payment) {
        return NextResponse.json(
          { ok: false, error: 'payment_not_found' },
          { status: 404 },
        );
      }

      const appointment = resolved.appointment ||
        (
          resolved.appointmentId
            ? await loadAppointmentForPayment(
                resolved.appointmentId,
              )
            : null
        );

      if (!appointment) {
        return NextResponse.json(
          {
            ok: false,
            error: 'payment_appointment_not_found',
          },
          { status: 409 },
        );
      }

      assertAppointmentAccessible(appointment, who);

      const meta = readMeta(payment.meta);
      const providerName = cleanPaymentProvider(
        meta.provider || appointment.paymentProvider,
      );
      const providerRef =
        clean(payment.providerRef || paymentRef, 160);

      if (
        isInternalProviderReference(
          providerName,
          providerRef,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'internal_payment_requires_authoritative_authorization_flow',
          },
          {
            status: 409,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }

      const externalProvider =
        externalProviderOrNull(providerName);

      if (!externalProvider) {
        return NextResponse.json(
          {
            ok: false,
            error: 'mock_payment_provider_disabled',
          },
          {
            status: 409,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }

      const expectedAmountCents =
        appointmentAmountCents(appointment);
      const expectedCurrency =
        appointmentCurrency(appointment);
      const verified = await verifyCheckout({
        provider: externalProvider,
        reference: providerRef,
        expectedAmountCents,
        expectedCurrency,
      });

      const synced =
        await syncVerifiedPaymentToAppointment({
          reference: providerRef,
          provider: externalProvider,
          state: verified.status,
          amountCents: verified.amountCents,
          currency: verified.currency,
          raw:
            (verified.raw as Record<string, unknown>) ||
            null,
        });

      if (verified.status === 'captured') {
        try {
          emitEvent({
            kind: 'payment_captured',
            encounterId: appointment.encounterId,
            patientId: appointment.patientId,
            clinicianId: appointment.clinicianId,
            payload: {
              paymentId: synced.payment.id,
              amount: synced.payment.amountCents,
            },
          } as any);
        } catch {
          // Runtime notification is best-effort.
        }
      }

      return NextResponse.json(
        {
          ok: true,
          payment: synced.payment,
          appointmentId: synced.appointment?.id || null,
          verificationStatus: verified.status,
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }

    if (action === 'cancel_booking') {
      const idempotencyKey = normalizeIdempotencyKey(req);
      const appointmentId = clean(
        body.appointmentId || body.appointment_id,
        160,
      );
      if (!appointmentId) {
        return NextResponse.json(
          { ok: false, error: 'appointmentId_required' },
          { status: 400 },
        );
      }

      const appointment = await loadAppointmentForPayment(appointmentId);
      assertAppointmentAccessible(appointment, who);
      const intent = await loadBookingIntentForAppointment(appointment.id);
      if (!intent) {
        return NextResponse.json(
          { ok: false, error: 'booking_intent_not_found' },
          { status: 409 },
        );
      }

      await prisma.$transaction(async (tx: any) => {
        await cancelBookingIntent({
          bookingIntentId: intent.id,
          reason: 'patient_cancelled_pending_booking',
          actorType: who.role,
          actorUserId: who.uid,
          tx,
        });
        await tx.bookingIntentAuditEvent.create({
          data: {
            bookingIntentId: intent.id,
            action: 'cancel_booking_idempotency_recorded',
            actorType: who.role,
            actorUserId: who.uid,
            reason: `idempotency:${sha256Hex(idempotencyKey).slice(0, 16)}`,
            orgId: appointment.orgId || 'org-default',
          },
        }).catch(() => null);
      });

      return NextResponse.json(
        {
          ok: true,
          appointmentId: appointment.id,
          booking: await bookingStateForAppointment(appointment.id),
          cancelled: true,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (action === 'switch_funding_to_card') {
      const idempotencyKey = normalizeIdempotencyKey(req);
      const appointmentId = clean(
        body.appointmentId || body.appointment_id,
        160,
      );
      if (!appointmentId) {
        return NextResponse.json(
          { ok: false, error: 'appointmentId_required' },
          { status: 400 },
        );
      }

      const appointment = await loadAppointmentForPayment(appointmentId);
      assertAppointmentAccessible(appointment, who);
      await reconcileCoverageAuthorization({ appointmentId });
      const intent = await loadBookingIntentForAppointment(appointmentId);
      if (!intent) {
        return NextResponse.json(
          { ok: false, error: 'booking_intent_not_found' },
          { status: 409 },
        );
      }

      const authorization = intent.coverageAuthorizationId
        ? await prisma.coverageAuthorization.findUnique({
            where: { id: intent.coverageAuthorizationId },
          })
        : null;
      const authorizationStatus = clean(authorization?.status, 40).toUpperCase();
      if (
        clean(intent.fundingMethod, 40).toUpperCase() !== 'MEDICAL_AID' ||
        !['DENIED', 'EXPIRED', 'CANCELLED'].includes(authorizationStatus)
      ) {
        return NextResponse.json(
          { ok: false, error: 'explicit_self_pay_switch_not_available' },
          { status: 409 },
        );
      }

      const holdExpiresAt = intent.holdExpiresAt ? new Date(intent.holdExpiresAt) : null;
      if (!holdExpiresAt || holdExpiresAt.getTime() <= Date.now()) {
        await expireBookingIntent({
          bookingIntentId: intent.id,
          reason: 'booking_hold_expired_before_funding_switch',
        });
        return NextResponse.json(
          { ok: false, error: 'booking_hold_expired' },
          { status: 409 },
        );
      }

      const totalMinor = Math.max(0, Number(intent.totalMinor || appointment.totalMinor || appointment.priceCents || 0));
      await prisma.$transaction(async (tx: any) => {
        await tx.bookingIntent.update({
          where: { id: intent.id },
          data: {
            fundingMethod: 'CARD',
            status: totalMinor > 0 ? 'PAYMENT_ACTION_REQUIRED' : 'CONFIRMED',
            sponsorAmountMinor: 0,
            patientPayableMinor: totalMinor,
            coverageDecision: 'PATIENT_SELECTED_SELF_PAY_AFTER_SPONSOR_DECISION',
            failureCode: null,
            confirmedAt: totalMinor <= 0 ? new Date() : null,
          },
        });
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            paymentMethod: 'CARD',
            paymentStatus: totalMinor > 0 ? 'PENDING' : 'NOT_REQUIRED',
            status: totalMinor > 0 ? 'pending_payment' : 'confirmed',
            sponsorAmountMinor: 0,
            patientCopayMinor: totalMinor,
            coverageDecision: 'PATIENT_SELECTED_SELF_PAY_AFTER_SPONSOR_DECISION',
            confirmedAt: totalMinor <= 0 ? new Date() : appointment.confirmedAt,
          },
        });
        await tx.bookingIntentRecipient.updateMany({
          where: { bookingIntentId: intent.id },
          data: {
            status: 'READY',
            sponsorAmountMinor: 0,
            patientPayableMinor: totalMinor,
            coverageDecision: 'PATIENT_SELECTED_SELF_PAY_AFTER_SPONSOR_DECISION',
          },
        });
        await tx.appointmentCareRecipient.updateMany({
          where: { appointmentId: appointment.id },
          data: {
            sponsorAmountMinor: 0,
            patientPayableMinor: totalMinor,
            coverageDecision: 'PATIENT_SELECTED_SELF_PAY_AFTER_SPONSOR_DECISION',
          },
        });
        await tx.bookingIntentAuditEvent.create({
          data: {
            bookingIntentId: intent.id,
            action: 'funding_switched_to_card',
            fromStatus: intent.status,
            toStatus: totalMinor > 0 ? 'PAYMENT_ACTION_REQUIRED' : 'CONFIRMED',
            actorType: who.role,
            actorUserId: who.uid,
            reason: `explicit_patient_choice:${sha256Hex(idempotencyKey).slice(0, 16)}`,
            orgId: appointment.orgId || 'org-default',
          },
        });
      });

      return NextResponse.json(
        {
          ok: true,
          appointmentId,
          booking: await bookingStateForAppointment(appointmentId),
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const idempotencyKey = normalizeIdempotencyKey(req);
    const appointmentId = clean(
      body.appointmentId || body.appointment_id,
      160,
    );

    if (!appointmentId) {
      return NextResponse.json(
        { ok: false, error: 'appointmentId_required' },
        { status: 400 },
      );
    }

    let appointment =
      await loadAppointmentForPayment(appointmentId);
    assertAppointmentAccessible(appointment, who);

    await reconcileCoverageAuthorization({ appointmentId });
    appointment = await loadAppointmentForPayment(appointmentId);
    const bookingIntent =
      await loadBookingIntentForAppointment(appointmentId);

    if (bookingIntent) {
      const bookingStatus = clean(bookingIntent.status, 40).toUpperCase();
      const holdExpiresAt = bookingIntent.holdExpiresAt
        ? new Date(bookingIntent.holdExpiresAt)
        : null;

      if (
        holdExpiresAt &&
        holdExpiresAt.getTime() <= Date.now() &&
        !['CONFIRMED', 'CANCELLED', 'EXPIRED'].includes(bookingStatus)
      ) {
        await expireBookingIntent({
          bookingIntentId: bookingIntent.id,
          reason: 'booking_hold_expired_before_payment_resume',
        });
        return NextResponse.json(
          { ok: false, error: 'booking_hold_expired' },
          { status: 409 },
        );
      }

      if (bookingStatus === 'SPONSOR_REVIEW') {
        return NextResponse.json(
          {
            ok: false,
            error: 'sponsor_authorization_pending',
            booking: await bookingStateForAppointment(appointmentId),
          },
          { status: 409 },
        );
      }

      if (['CANCELLED', 'EXPIRED'].includes(bookingStatus)) {
        return NextResponse.json(
          { ok: false, error: 'booking_not_payable', bookingStatus },
          { status: 409 },
        );
      }
    }

    if (
      ['CAPTURED', 'PAID', 'SETTLED', 'NOT_REQUIRED'].includes(
        clean(appointment.paymentStatus, 40).toUpperCase(),
      )
    ) {
      return NextResponse.json(
        {
          ok: true,
          alreadySettled: true,
          appointmentId: appointment.id,
          paymentStatus: appointment.paymentStatus,
        },
        { status: 200 },
      );
    }

    if (appointmentPaymentWindowClosed(appointment)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'appointment_payment_window_closed',
          appointmentId: appointment.id,
          rebookRequired: true,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    appointment = await releaseStaleProviderPaymentPointer(appointment);

    const replay = await existingPaymentResponse(appointment);
    if (replay) {
      return NextResponse.json(replay, { status: 200 });
    }

    const requestedMethod = clean(
      body.paymentMethod || body.payment_method || 'CARD',
      40,
    ).toUpperCase();
    const appointmentMethod = clean(
      appointment.paymentMethod || requestedMethod,
      40,
    ).toUpperCase();

    const bookingStatus = clean(bookingIntent?.status, 40).toUpperCase();
    const bookingPatientPayable = Number(bookingIntent?.patientPayableMinor || 0);
    const cardSettlementAllowed = bookingIntent
      ? (
          requestedMethod === 'CARD' &&
          bookingPatientPayable > 0 &&
          ['CARD', 'MEDICAL_AID', 'VOUCHER'].includes(appointmentMethod) &&
          ['PAYMENT_ACTION_REQUIRED', 'COPAY_REQUIRED', 'PAYMENT_FAILED', 'PAYMENT_PROCESSING'].includes(bookingStatus)
        )
      : requestedMethod === 'CARD' && appointmentMethod === 'CARD';

    if (!cardSettlementAllowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'payment_method_requires_authoritative_authorization_flow',
          bookingStatus: bookingStatus || null,
          fundingMethod: appointmentMethod || null,
        },
        { status: 409 },
      );
    }

    const amountCents =
      appointmentAmountCents(appointment);
    const currency =
      appointmentCurrency(appointment);

    if (amountCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'appointment_payment_not_required',
        },
        { status: 409 },
      );
    }

    const keyHash = sha256Hex(
      `${appointment.id}\u0000${who.uid}\u0000${idempotencyKey}`,
    );
    const reservationId =
      `init-${keyHash.slice(0, 48)}`;
    const bookingAttemptId = bookingIntent
      ? `bpa-${sha256Hex(`${bookingIntent.id}\u0000${idempotencyKey}`).slice(0, 32)}`
      : null;

    if (bookingIntent && bookingAttemptId) {
      const existingAttempt = await prisma.bookingPaymentAttempt.findUnique({
        where: { id: bookingAttemptId },
      });
      if (existingAttempt) {
        const attemptStatus = clean(existingAttempt.status, 40).toUpperCase();
        if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(attemptStatus)) {
          return NextResponse.json(
            {
              ok: false,
              error: 'payment_attempt_terminal_use_new_retry_key',
              attemptStatus,
              booking: await bookingStateForAppointment(appointment.id),
            },
            { status: 409 },
          );
        }

        const replay = await existingPaymentResponse(appointment);
        if (replay) {
          return NextResponse.json(
            { ...replay, booking: await bookingStateForAppointment(appointment.id) },
            { status: 200 },
          );
        }
      }
    }
    const appointmentMeta =
      readMeta(appointment.meta);
    const initialization =
      readMeta(appointmentMeta.paymentInitialization);
    const initializedAt = Date.parse(
      clean(initialization.reservedAt, 80),
    );
    const reservationStale =
      Number.isFinite(initializedAt) &&
      Date.now() - initializedAt > 10 * 60_000;

    if (
      clean(appointment.paymentIntentId).startsWith('init-') &&
      reservationStale
    ) {
      await prisma.appointment.updateMany({
        where: {
          id: appointment.id,
          paymentIntentId: appointment.paymentIntentId,
        },
        data: {
          paymentIntentId: null,
          meta: jsonSafe({
            ...appointmentMeta,
            paymentInitialization: {
              ...initialization,
              state: 'STALE_RESERVATION_RELEASED',
              releasedAt: new Date().toISOString(),
            },
          }),
        },
      });

      appointment =
        await loadAppointmentForPayment(appointment.id);
    }

    const reservedAt = new Date().toISOString();
    const reservation = await prisma.appointment.updateMany({
      where: {
        id: appointment.id,
        paymentIntentId: null,
      },
      data: {
        paymentIntentId: reservationId,
        meta: jsonSafe({
          ...readMeta(appointment.meta),
          paymentInitialization: {
            state: 'RESERVED',
            reservationId,
            idempotencyKeyHash: keyHash,
            reservedAt,
            actorUserId: who.uid,
          },
        }),
      },
    });

    if (reservation.count !== 1) {
      const current =
        await loadAppointmentForPayment(appointment.id);
      const existing =
        await existingPaymentResponse(current);

      if (existing) {
        return NextResponse.json(
          existing,
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'payment_initialization_in_progress',
        },
        { status: 409 },
      );
    }

    if (bookingIntent && bookingAttemptId) {
      const latestAttempt = await prisma.bookingPaymentAttempt.findFirst({
        where: { bookingIntentId: bookingIntent.id },
        orderBy: { sequence: 'desc' },
      });
      const sequence = Math.max(1, Number(latestAttempt?.sequence || 0) + 1);
      await prisma.bookingPaymentAttempt.create({
        data: {
          id: bookingAttemptId,
          bookingIntentId: bookingIntent.id,
          sequence,
          method: 'CARD',
          status: 'CREATED',
          idempotencyKeyHash: keyHash,
          amountMinor: amountCents,
          currency,
          expiresAt: bookingIntent.holdExpiresAt || null,
          metadata: {
            source: 'patient_appointment_checkout',
            masterFundingMethod: appointment.paymentMethod || 'CARD',
            appointmentId: appointment.id,
          },
          orgId: appointment.orgId || 'org-default',
        },
      });
    }

    const paymentId =
      `pay-${sha256Hex(
        `${appointment.id}\u0000${idempotencyKey}`,
      ).slice(0, 32)}`;
    let checkout:
      Awaited<ReturnType<typeof beginCheckout>> | null = null;

    try {
      checkout = await beginCheckout({
        method: 'CARD',
        appointmentId: appointment.id,
        amountCents,
        currency,
        email: clean(body.email, 320) || null,
        callbackUrl: safeCallbackUrl(
          body.callbackUrl || body.callback_url,
        ),
        metadata: {
          appointmentId: appointment.id,
          encounterId: appointment.encounterId,
          caseId: appointment.caseId,
          clinicianId: appointment.clinicianId,
          patientId: appointment.patientId,
          source: 'patient_appointment_checkout',
          idempotencyKeyHash: keyHash,
          priceLockHash: clean(
            readMeta(appointment.meta)
              .bookingIntegrity?.priceLockHash,
            128,
          ) || null,
        },
      });
    } catch (error) {
      await prisma.appointment.updateMany({
        where: {
          id: appointment.id,
          paymentIntentId: reservationId,
        },
        data: {
          paymentIntentId: null,
          paymentStatus: 'FAILED',
          meta: jsonSafe({
            ...readMeta(appointment.meta),
            paymentInitialization: {
              state: 'PROVIDER_INITIALIZATION_FAILED',
              reservationId,
              idempotencyKeyHash: keyHash,
              failedAt: new Date().toISOString(),
            },
          }),
        },
      });
      if (bookingIntent && bookingAttemptId) {
        await prisma.bookingPaymentAttempt.updateMany({
          where: { id: bookingAttemptId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureCode: 'provider_initialization_failed',
          },
        });
        await prisma.bookingIntent.updateMany({
          where: {
            id: bookingIntent.id,
            status: { notIn: ['CONFIRMED', 'EXPIRED', 'CANCELLED'] },
          },
          data: {
            status: 'PAYMENT_FAILED',
            failureCode: 'provider_initialization_failed',
          },
        });
      }
      throw error;
    }

    await prisma.appointment.updateMany({
      where: {
        id: appointment.id,
        paymentIntentId: reservationId,
      },
      data: {
        paymentProvider: checkout.provider,
        paymentRef: checkout.reference,
        meta: jsonSafe({
          ...readMeta(appointment.meta),
          paymentInitialization: {
            state: 'PROVIDER_INITIALIZED',
            reservationId,
            provider: checkout.provider,
            providerRef: checkout.reference,
            idempotencyKeyHash: keyHash,
            initializedAt: new Date().toISOString(),
          },
        }),
      },
    });

    if (bookingIntent && bookingAttemptId) {
      await prisma.bookingPaymentAttempt.updateMany({
        where: { id: bookingAttemptId },
        data: {
          provider: checkout.provider,
          providerRef: checkout.reference,
          status:
            checkout.status === 'authorized'
              ? 'AUTHORIZED'
              : checkout.status === 'pending_review'
                ? 'PENDING_REVIEW'
                : checkout.status === 'pending_redirect'
                  ? 'PENDING_REDIRECT'
                  : 'PROCESSING',
          providerSnapshot: jsonSafe({
            redirectUrl: checkout.redirectUrl,
            checkout: checkout.raw ?? null,
            initializedAt: new Date().toISOString(),
          }),
        },
      });
    }

    const paymentStatus =
      paymentStatusFromCheckout(checkout.status);
    const paymentMeta = jsonSafe({
      appointmentId: appointment.id,
      encounterId: appointment.encounterId,
      caseId: appointment.caseId,
      provider: checkout.provider,
      providerRef: checkout.reference,
      paymentMethod: 'CARD',
      masterFundingMethod: appointment.paymentMethod || 'CARD',
      bookingIntentId: bookingIntent?.id || null,
      bookingPaymentAttemptId: bookingAttemptId,
      redirectUrl: checkout.redirectUrl,
      checkout: checkout.raw ?? null,
      idempotencyKeyHash: keyHash,
      initializedAt: new Date().toISOString(),
    });

    const result = await prisma.$transaction(
      async (tx: any) => {
        const payment = await tx.payment.upsert({
          where: { id: paymentId },
          create: {
            id: paymentId,
            encounterId: appointment.encounterId,
            caseId: appointment.caseId,
            amountCents,
            currency,
            status: paymentStatus,
            providerRef: checkout!.reference,
            meta: paymentMeta,
            orgId: appointment.orgId,
          },
          update: {
            status: paymentStatus,
            providerRef: checkout!.reference,
            meta: paymentMeta,
          },
        });

        if (bookingIntent && bookingAttemptId) {
          const nextAttemptStatus =
            payment.status === 'captured'
              ? 'CAPTURED'
              : payment.status === 'pending'
                ? 'PENDING_REDIRECT'
                : 'FAILED';
          await tx.bookingPaymentAttempt.updateMany({
            where: { id: bookingAttemptId },
            data: {
              status: nextAttemptStatus,
              capturedAt:
                nextAttemptStatus === 'CAPTURED' ? new Date() : undefined,
              failedAt:
                nextAttemptStatus === 'FAILED' ? new Date() : undefined,
              failureCode:
                nextAttemptStatus === 'FAILED' ? 'checkout_initialization_failed' : null,
            },
          });
          await tx.bookingIntent.updateMany({
            where: {
              id: bookingIntent.id,
              status: { notIn: ['CONFIRMED', 'EXPIRED', 'CANCELLED'] },
            },
            data: {
              status:
                nextAttemptStatus === 'CAPTURED'
                  ? 'CONFIRMED'
                  : nextAttemptStatus === 'FAILED'
                    ? 'PAYMENT_FAILED'
                    : 'PAYMENT_PROCESSING',
              confirmedAt:
                nextAttemptStatus === 'CAPTURED' ? new Date() : undefined,
              failureCode:
                nextAttemptStatus === 'FAILED' ? 'checkout_initialization_failed' : null,
            },
          });
          if (nextAttemptStatus === 'CAPTURED') {
            await tx.bookingSlotLease.updateMany({
              where: { bookingIntentId: bookingIntent.id, status: 'ACTIVE' },
              data: { status: 'CONSUMED', consumedAt: new Date() },
            });
          }
        }

        const updatedAppointment =
          await tx.appointment.update({
            where: { id: appointment.id },
            data: {
              paymentIntentId: payment.id,
              paymentProvider: checkout!.provider,
              paymentRef: checkout!.reference,
              paymentStatus:
                payment.status === 'captured'
                  ? 'CAPTURED'
                  : payment.status === 'pending'
                    ? 'PENDING'
                    : 'FAILED',
              status:
                payment.status === 'captured' &&
                appointment.status === 'pending_payment'
                  ? 'confirmed'
                  : appointment.status,
              confirmedAt:
                payment.status === 'captured'
                  ? appointment.confirmedAt || new Date()
                  : appointment.confirmedAt,
              meta: jsonSafe({
                ...readMeta(appointment.meta),
                paymentInitialization: {
                  state: 'INITIALIZED',
                  reservationId,
                  paymentId: payment.id,
                  providerRef: checkout!.reference,
                  idempotencyKeyHash: keyHash,
                  initializedAt:
                    new Date().toISOString(),
                },
              }),
            },
          });

        await tx.appointmentAuditEvent
          .create({
            data: {
              appointmentId: appointment.id,
              action: 'payment_initialized',
              actorType: who.role,
              actorUserId: who.uid,
              reason: 'appointment_card_checkout',
              beforeJson: {
                paymentIntentId:
                  appointment.paymentIntentId,
                paymentStatus:
                  appointment.paymentStatus,
              },
              afterJson: {
                paymentIntentId: payment.id,
                paymentStatus:
                  updatedAppointment.paymentStatus,
                provider:
                  checkout!.provider,
                providerRef:
                  checkout!.reference,
                amountCents,
                currency,
                idempotencyKeyHash: keyHash,
              },
              orgId:
                appointment.orgId || 'org-default',
            },
          })
          .catch(() => null);

        return {
          payment,
          appointment: updatedAppointment,
        };
      },
    );

    await prisma.auditEvent
      .create({
        data: {
          kind: 'payment_initiated',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: result.payment.id,
          meta: jsonSafe({
            appointmentId: appointment.id,
            encounterId: appointment.encounterId,
            amountCents,
            currency,
            providerRef: checkout.reference,
            paymentMethod: 'CARD',
            idempotencyKeyHash: keyHash,
          }),
        },
      })
      .catch(() => null);

    return NextResponse.json(
      {
        ok: true,
        payment: result.payment,
        appointmentId: result.appointment.id,
        redirectUrl: checkout.redirectUrl,
        providerRef: checkout.reference,
        status: checkout.status,
        booking: await bookingStateForAppointment(result.appointment.id),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error(
      '[api-gateway][payments] error',
      error,
    );

    const message = String(
      error?.message || 'payment_failed',
    );
    const status = Number(error?.status) ||
      (
        message.toLowerCase().includes('unauthorized')
          ? 401
          : message.toLowerCase().includes('forbidden')
            ? 403
            : message.toLowerCase().includes('not_found')
              ? 404
              : 500
      );

    return NextResponse.json(
      { ok: false, error: message },
      { status },
    );
  }
}
