import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';

export const BOOKING_HOLD_TTL_MS = 20 * 60 * 1000;

const TERMINAL_APPOINTMENT_STATUSES = new Set([
  'cancelled',
  'canceled',
  'completed',
  'payment_expired',
  'cancelled_payment_timeout',
  'payment_init_failed',
]);

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function bookingIntentId(hostUserId: string, idempotencyKey: string) {
  return `bki-${sha256Hex(`${hostUserId}\u0000${idempotencyKey}`).slice(0, 32)}`;
}

export function bookingSlotKey(args: {
  clinicianId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  return [
    clean(args.clinicianId, 160),
    args.startsAt.toISOString(),
    args.endsAt.toISOString(),
  ].join('|');
}

export function computeBookingHoldExpiresAt(args: {
  now?: Date;
  startsAt: Date;
  priceLockExpiresAt?: Date | null;
}) {
  const now = args.now ?? new Date();
  const candidates = [
    now.getTime() + BOOKING_HOLD_TTL_MS,
    args.startsAt.getTime(),
  ];

  if (args.priceLockExpiresAt && Number.isFinite(args.priceLockExpiresAt.getTime())) {
    candidates.push(args.priceLockExpiresAt.getTime());
  }

  const expiresAt = new Date(Math.min(...candidates));
  if (expiresAt.getTime() <= now.getTime() + 30_000) {
    throw Object.assign(new Error('booking_hold_window_too_short'), { status: 409 });
  }

  return expiresAt;
}

export function appointmentStatusIsTerminal(value: unknown) {
  return TERMINAL_APPOINTMENT_STATUSES.has(clean(value, 80).toLowerCase());
}

export async function lockClinicianBookingLane(tx: any, clinicianId: string) {
  const lane = `ambulant:booking:${clean(clinicianId, 160)}`;
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    lane,
  );
}

export async function loadBookingIntentForAppointment(
  appointmentId: string,
  db: any = prisma,
) {
  return db.bookingIntent.findFirst({
    where: { appointmentId },
    include: {
      slotLease: true,
      paymentAttempts: {
        orderBy: { sequence: 'desc' },
      },
    },
  });
}

export function bookingStateShape(intent: any, authorization?: any | null) {
  if (!intent) return null;

  const now = Date.now();
  const holdExpiresAt = intent.holdExpiresAt
    ? new Date(intent.holdExpiresAt)
    : intent.slotLease?.expiresAt
      ? new Date(intent.slotLease.expiresAt)
      : null;
  const leaseStatus = clean(intent.slotLease?.status, 80).toUpperCase();
  const intentStatus = clean(intent.status, 80).toUpperCase();
  const holdActive =
    leaseStatus === 'ACTIVE' &&
    Boolean(holdExpiresAt && holdExpiresAt.getTime() > now);

  const authorizationStatus = clean(authorization?.status, 80).toUpperCase() || null;
  const canResumePayment =
    holdActive &&
    ['PAYMENT_ACTION_REQUIRED', 'COPAY_REQUIRED', 'PAYMENT_FAILED'].includes(intentStatus) &&
    Number(intent.patientPayableMinor || 0) > 0;

  return {
    intentId: intent.id,
    status: intentStatus,
    fundingMethod: clean(intent.fundingMethod, 80).toUpperCase() || null,
    holdExpiresAt: holdExpiresAt?.toISOString() || null,
    holdActive,
    slotLeaseStatus: leaseStatus || null,
    patientPayableMinor: Number(intent.patientPayableMinor || 0),
    sponsorAmountMinor: Number(intent.sponsorAmountMinor || 0),
    currency: clean(intent.currency, 3).toUpperCase() || 'ZAR',
    coverageDecision: clean(intent.coverageDecision, 80).toUpperCase() || null,
    coverageAuthorizationId: intent.coverageAuthorizationId || null,
    coverageAuthorizationStatus: authorizationStatus,
    canResumePayment,
    requiresSponsorReview:
      intentStatus === 'SPONSOR_REVIEW' &&
      (!authorizationStatus || ['DRAFT', 'PENDING'].includes(authorizationStatus)),
    requiresExplicitFundingChange:
      intentStatus === 'SPONSOR_REVIEW' &&
      ['DENIED', 'EXPIRED', 'CANCELLED'].includes(authorizationStatus || ''),
    latestPaymentAttempt: intent.paymentAttempts?.[0]
      ? {
          id: intent.paymentAttempts[0].id,
          sequence: intent.paymentAttempts[0].sequence,
          method: intent.paymentAttempts[0].method,
          status: intent.paymentAttempts[0].status,
          provider: intent.paymentAttempts[0].provider,
          providerRef: intent.paymentAttempts[0].providerRef,
          amountMinor: intent.paymentAttempts[0].amountMinor,
          currency: intent.paymentAttempts[0].currency,
          expiresAt: intent.paymentAttempts[0].expiresAt?.toISOString?.() ?? intent.paymentAttempts[0].expiresAt ?? null,
        }
      : null,
  };
}

async function releaseProvisionalVoucherReservation(
  db: any,
  intent: any,
  reason: string,
) {
  if (clean(intent?.fundingMethod, 80).toUpperCase() !== 'VOUCHER') return false;

  const coverage =
    intent?.coverageSnapshot &&
    typeof intent.coverageSnapshot === 'object' &&
    !Array.isArray(intent.coverageSnapshot)
      ? (intent.coverageSnapshot as Record<string, any>)
      : {};

  const voucherId = clean(coverage.voucherId, 160);
  const userId = clean(intent?.hostUserId, 160);
  if (!voucherId || !userId) return false;

  const redemptions = await db.voucherRedemption.findMany({
    where: {
      voucherId,
      userId,
    },
    orderBy: { redeemedAt: 'desc' },
    take: 20,
  });

  const redemption = redemptions.find((row: any) => {
    const meta =
      row?.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
        ? row.meta
        : {};
    return (
      clean(meta.source, 120) === 'canonical_patient_booking' &&
      clean(meta.bookingIntentId, 160) === clean(intent.id, 160) &&
      meta.provisional === true
    );
  });

  if (!redemption) return false;

  const voucher = await db.voucherCode.findUnique({
    where: { id: voucherId },
  });

  if (!voucher) {
    await db.voucherRedemption.delete({ where: { id: redemption.id } });
    return true;
  }

  const meta =
    redemption.meta &&
    typeof redemption.meta === 'object' &&
    !Array.isArray(redemption.meta)
      ? redemption.meta
      : {};

  const nextUsedCount = Math.max(0, Number(voucher.usedCount || 0) - 1);
  const now = new Date();
  const stillWithinValidity =
    (!voucher.validFrom || voucher.validFrom <= now) &&
    (!voucher.expiresAt || voucher.expiresAt > now);

  const autoDeactivatedAtReservation = meta.voucherAutoDeactivated === true;
  const reservationUpdatedAt = redemption.redeemedAt
    ? new Date(redemption.redeemedAt).getTime()
    : 0;
  const voucherUpdatedAt = voucher.updatedAt
    ? new Date(voucher.updatedAt).getTime()
    : 0;

  // Re-enable only when this reservation itself exhausted the voucher and no
  // later administrative mutation is visible. This avoids undoing a deliberate
  // post-booking deactivation.
  const mayReactivate =
    !voucher.active &&
    autoDeactivatedAtReservation &&
    stillWithinValidity &&
    voucherUpdatedAt <= reservationUpdatedAt + 5_000;

  const mutation = await db.voucherCode.updateMany({
    where: {
      id: voucher.id,
      usedCount: voucher.usedCount,
      active: voucher.active,
    },
    data: {
      usedCount: nextUsedCount,
      active: mayReactivate ? true : voucher.active,
    },
  });

  if (mutation.count !== 1) {
    throw Object.assign(new Error('voucher_reservation_release_conflict'), {
      status: 409,
    });
  }

  await db.voucherRedemption.delete({
    where: { id: redemption.id },
  });

  await db.bookingIntentAuditEvent.create({
    data: {
      bookingIntentId: intent.id,
      action: 'voucher_reservation_released',
      fromStatus: intent.status,
      toStatus: intent.status,
      actorType: 'system',
      reason: clean(reason || 'pending_booking_released', 240),
      afterJson: jsonSafe({
        voucherId,
        redemptionId: redemption.id,
        usedCountBefore: voucher.usedCount,
        usedCountAfter: nextUsedCount,
        reactivated: mayReactivate,
      }),
      orgId: intent.orgId || 'org-default',
    },
  }).catch(() => null);

  return true;
}

export async function expireBookingIntent(args: {
  bookingIntentId: string;
  reason?: string;
  actorType?: string;
  actorUserId?: string | null;
  tx?: any;
}): Promise<any> {
  if (!args.tx) {
    return prisma.$transaction((tx: any) =>
      expireBookingIntent({
        ...args,
        tx,
      }),
    );
  }

  const db = args.tx;
  const now = new Date();
  const intent = await db.bookingIntent.findUnique({
    where: { id: args.bookingIntentId },
    include: { slotLease: true },
  });

  if (!intent) return null;
  if (['CONFIRMED', 'CANCELLED', 'EXPIRED'].includes(clean(intent.status, 80).toUpperCase())) {
    return intent;
  }

  await releaseProvisionalVoucherReservation(
    db,
    intent,
    args.reason || 'booking_hold_expired',
  );

  await db.bookingPaymentAttempt.updateMany({
    where: {
      bookingIntentId: intent.id,
      status: { in: ['CREATED', 'PENDING_REDIRECT', 'PROCESSING', 'AUTHORIZED', 'PENDING_REVIEW', 'FAILED'] },
    },
    data: {
      status: 'EXPIRED',
      cancelledAt: now,
      failureCode: clean(args.reason || 'booking_hold_expired', 160),
    },
  });

  await db.bookingSlotLease.updateMany({
    where: { bookingIntentId: intent.id, status: 'ACTIVE' },
    data: {
      status: 'EXPIRED',
      releasedAt: now,
      releaseReason: clean(args.reason || 'booking_hold_expired', 160),
    },
  });

  const updated = await db.bookingIntent.update({
    where: { id: intent.id },
    data: {
      status: 'EXPIRED',
      expiredAt: now,
      failureCode: clean(args.reason || 'booking_hold_expired', 160),
    },
  });

  if (intent.appointmentId) {
    await db.appointment.updateMany({
      where: {
        id: intent.appointmentId,
        status: { notIn: ['confirmed', 'completed', 'cancelled', 'canceled'] },
      },
      data: {
        status: 'payment_expired',
        paymentStatus: 'FAILED',
      },
    });
  }

  await db.bookingIntentAuditEvent.create({
    data: {
      bookingIntentId: intent.id,
      action: 'booking_hold_expired',
      fromStatus: intent.status,
      toStatus: 'EXPIRED',
      actorType: args.actorType || 'system',
      actorUserId: args.actorUserId || null,
      reason: clean(args.reason || 'booking_hold_expired', 240),
      orgId: intent.orgId || 'org-default',
    },
  }).catch(() => null);

  return updated;
}

export async function cancelBookingIntent(args: {
  bookingIntentId: string;
  reason?: string;
  actorType?: string;
  actorUserId?: string | null;
  tx?: any;
}): Promise<any> {
  if (!args.tx) {
    return prisma.$transaction((tx: any) =>
      cancelBookingIntent({
        ...args,
        tx,
      }),
    );
  }

  const db = args.tx;
  const now = new Date();
  const intent = await db.bookingIntent.findUnique({
    where: { id: args.bookingIntentId },
    include: { slotLease: true },
  });

  if (!intent) return null;
  const current = clean(intent.status, 80).toUpperCase();
  if (current === 'CANCELLED') return intent;
  if (current === 'CONFIRMED') {
    throw Object.assign(new Error('confirmed_booking_requires_cancellation_policy_flow'), { status: 409 });
  }
  if (current === 'EXPIRED') return intent;

  await releaseProvisionalVoucherReservation(
    db,
    intent,
    args.reason || 'patient_cancelled_pending_booking',
  );

  await db.bookingPaymentAttempt.updateMany({
    where: {
      bookingIntentId: intent.id,
      status: { notIn: ['CAPTURED', 'CANCELLED', 'EXPIRED'] },
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      failureCode: clean(args.reason || 'patient_cancelled_pending_booking', 160),
    },
  });

  await db.bookingSlotLease.updateMany({
    where: { bookingIntentId: intent.id, status: 'ACTIVE' },
    data: {
      status: 'CANCELLED',
      releasedAt: now,
      releaseReason: clean(args.reason || 'patient_cancelled_pending_booking', 160),
    },
  });

  const updated = await db.bookingIntent.update({
    where: { id: intent.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      failureCode: clean(args.reason || 'patient_cancelled_pending_booking', 160),
    },
  });

  if (intent.appointmentId) {
    await db.appointment.updateMany({
      where: {
        id: intent.appointmentId,
        status: { notIn: ['confirmed', 'completed', 'cancelled', 'canceled'] },
      },
      data: {
        status: 'cancelled',
        paymentStatus: 'CANCELLED',
      },
    });
  }

  await db.bookingIntentAuditEvent.create({
    data: {
      bookingIntentId: intent.id,
      action: 'pending_booking_cancelled',
      fromStatus: intent.status,
      toStatus: 'CANCELLED',
      actorType: args.actorType || 'patient',
      actorUserId: args.actorUserId || null,
      reason: clean(args.reason || 'patient_cancelled_pending_booking', 240),
      orgId: intent.orgId || 'org-default',
    },
  }).catch(() => null);

  return updated;
}

export async function reconcileCoverageAuthorization(args: {
  appointmentId: string;
  tx?: any;
}): Promise<any> {
  if (!args.tx) {
    return prisma.$transaction((tx: any) =>
      reconcileCoverageAuthorization({
        appointmentId: args.appointmentId,
        tx,
      }),
    );
  }

  const db = args.tx;
  const intent = await loadBookingIntentForAppointment(args.appointmentId, db);
  if (!intent || !intent.coverageAuthorizationId) return intent;

  const auth = await db.coverageAuthorization.findUnique({
    where: { id: intent.coverageAuthorizationId },
  });
  if (!auth) return intent;

  const authStatus = clean(auth.status, 80).toUpperCase();
  const intentStatus = clean(intent.status, 80).toUpperCase();
  const now = new Date();

  if (
    intent.slotLease?.status === 'ACTIVE' &&
    intent.slotLease.expiresAt &&
    new Date(intent.slotLease.expiresAt).getTime() <= now.getTime()
  ) {
    await expireBookingIntent({
      bookingIntentId: intent.id,
      reason: 'booking_hold_expired',
      tx: db,
    });
    return loadBookingIntentForAppointment(args.appointmentId, db);
  }

  if (intentStatus !== 'SPONSOR_REVIEW') return intent;

  if (['DENIED', 'EXPIRED', 'CANCELLED'].includes(authStatus)) {
    await db.bookingIntent.update({
      where: { id: intent.id },
      data: {
        coverageDecision: authStatus,
        failureCode: `coverage_authorization_${authStatus.toLowerCase()}`,
      },
    });
    await db.bookingIntentRecipient.updateMany({
      where: { bookingIntentId: intent.id },
      data: {
        status: 'DECLINED',
        coverageDecision: authStatus,
        sponsorAmountMinor: 0,
      },
    });
    await db.appointmentCareRecipient.updateMany({
      where: { appointmentId: args.appointmentId },
      data: {
        coverageDecision: authStatus,
        sponsorAmountMinor: 0,
      },
    });
    return loadBookingIntentForAppointment(args.appointmentId, db);
  }

  if (!['APPROVED', 'PARTIALLY_APPROVED', 'CONSUMED'].includes(authStatus)) {
    return intent;
  }

  const requested = Number(auth.requestedAmountMinor ?? intent.totalMinor ?? 0);
  const approved = Math.max(
    0,
    Math.min(
      requested,
      Number(
        auth.approvedAmountMinor ??
          auth.allowedAmountMinor ??
          requested,
      ) || 0,
    ),
  );
  const patientPayable = Math.max(0, requested - approved);
  const nextStatus = patientPayable > 0 ? 'COPAY_REQUIRED' : 'CONFIRMED';

  const reconciledDecision =
    authStatus === 'PARTIALLY_APPROVED' || patientPayable > 0
      ? 'COVERED_WITH_COPAY'
      : 'COVERED';

  await db.bookingIntent.update({
    where: { id: intent.id },
    data: {
      status: nextStatus,
      coverageDecision: reconciledDecision,
      sponsorAmountMinor: approved,
      patientPayableMinor: patientPayable,
      authorizedAt: auth.decidedAt || now,
      confirmedAt: patientPayable === 0 ? now : null,
      failureCode: null,
    },
  });
  await db.bookingIntentRecipient.updateMany({
    where: { bookingIntentId: intent.id },
    data: {
      status: patientPayable > 0 ? 'COPAY_REQUIRED' : 'COVERED',
      coverageDecision: reconciledDecision,
      sponsorAmountMinor: approved,
      patientPayableMinor: patientPayable,
    },
  });
  await db.appointmentCareRecipient.updateMany({
    where: { appointmentId: args.appointmentId },
    data: {
      coverageDecision: reconciledDecision,
      sponsorAmountMinor: approved,
      patientPayableMinor: patientPayable,
    },
  });

  if (patientPayable === 0) {
    await db.bookingSlotLease.updateMany({
      where: { bookingIntentId: intent.id, status: 'ACTIVE' },
      data: { status: 'CONSUMED', consumedAt: now },
    });

    await db.appointment.update({
      where: { id: args.appointmentId },
      data: {
        status: 'confirmed',
        confirmedAt: now,
        paymentStatus: 'AUTHORIZED',
        sponsorAmountMinor: approved,
        patientCopayMinor: 0,
        coverageDecision: reconciledDecision,
      },
    });
  } else {
    await db.appointment.update({
      where: { id: args.appointmentId },
      data: {
        status: 'pending_payment',
        paymentStatus: 'PENDING',
        sponsorAmountMinor: approved,
        patientCopayMinor: patientPayable,
        coverageDecision: reconciledDecision,
      },
    });
  }

  return loadBookingIntentForAppointment(args.appointmentId, db);
}

export async function bookingStateForAppointment(appointmentId: string) {
  const intent = await reconcileCoverageAuthorization({ appointmentId });
  if (!intent) return null;
  const authorization = intent.coverageAuthorizationId
    ? await prisma.coverageAuthorization.findUnique({
        where: { id: intent.coverageAuthorizationId },
      }).catch(() => null)
    : null;
  return bookingStateShape(intent, authorization);
}

export async function expireDueBookingIntents(limit = 100) {
  const now = new Date();
  const intents = await prisma.bookingIntent.findMany({
    where: {
      holdExpiresAt: { lte: now },
      status: {
        in: [
          'SLOT_HELD',
          'PAYMENT_ACTION_REQUIRED',
          'PAYMENT_PROCESSING',
          'SPONSOR_REVIEW',
          'COPAY_REQUIRED',
          'PAYMENT_FAILED',
        ],
      },
    },
    orderBy: { holdExpiresAt: 'asc' },
    take: Math.max(1, Math.min(500, limit)),
  });

  let expired = 0;
  for (const intent of intents) {
    await prisma.$transaction(async (tx: any) => {
      const current = await tx.bookingIntent.findUnique({ where: { id: intent.id } });
      if (!current || !current.holdExpiresAt || current.holdExpiresAt > now) return;
      if (![
        'SLOT_HELD',
        'PAYMENT_ACTION_REQUIRED',
        'PAYMENT_PROCESSING',
        'SPONSOR_REVIEW',
        'COPAY_REQUIRED',
        'PAYMENT_FAILED',
      ].includes(clean(current.status, 80).toUpperCase())) return;
      await expireBookingIntent({ bookingIntentId: current.id, reason: 'booking_hold_expired', tx });
      expired += 1;
    });
  }

  return expired;
}
