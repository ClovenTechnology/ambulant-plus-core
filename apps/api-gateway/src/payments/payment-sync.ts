import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppointmentPaymentStatus } from '@prisma/client';
import { prisma } from '@/src/lib/db';

export type PaymentVerificationState =
  | 'captured'
  | 'pending'
  | 'failed';

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

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

function toAppointmentPaymentStatus(
  state: PaymentVerificationState,
): AppointmentPaymentStatus {
  if (state === 'captured') {
    return AppointmentPaymentStatus.CAPTURED;
  }
  if (state === 'pending') {
    return AppointmentPaymentStatus.PENDING;
  }
  return AppointmentPaymentStatus.FAILED;
}

function expectedAppointmentAmount(appointment: any) {
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

  return null;
}

function expectedAppointmentCurrency(appointment: any) {
  const value = clean(
    appointment?.currency ||
      appointment?.sponsorCurrency,
    3,
  ).toUpperCase();

  return /^[A-Z]{3}$/.test(value)
    ? value
    : null;
}

export function extractAppointmentIdFromPaymentReference(
  reference: string,
) {
  const value = clean(reference, 320);
  const match = value.match(
    /(?:^|_)(appt-[A-Za-z0-9-]+)(?:_|$)/,
  );
  return match?.[1] || null;
}

function uniq(
  values: Array<string | null | undefined>,
) {
  return Array.from(
    new Set(
      values
        .map((value) => clean(value, 240))
        .filter(Boolean),
    ),
  );
}

export async function resolvePaymentReference(
  reference: string,
) {
  const value = clean(reference, 320);

  if (!value) {
    return {
      appointment: null as any,
      payment: null as any,
      appointmentId: null as string | null,
    };
  }

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { providerRef: value },
        { id: value },
      ],
    },
  }).catch(() => null);

  const paymentMeta = readMeta(payment?.meta);
  const appointmentIdCandidates = uniq([
    paymentMeta.appointmentId,
    paymentMeta.appointment_id,
    paymentMeta.appointment?.id,
    extractAppointmentIdFromPaymentReference(value),
  ]);
  const appointmentOr: any[] = [
    { paymentRef: value },
    { paymentIntentId: payment?.id || undefined },
  ].filter((candidate: any) =>
    Object.values(candidate).every(Boolean),
  );

  for (const id of appointmentIdCandidates) {
    appointmentOr.push({ id });
  }

  const appointment = appointmentOr.length
    ? await prisma.appointment.findFirst({
        where: { OR: appointmentOr },
      }).catch(() => null)
    : null;

  return {
    appointment,
    payment,
    appointmentId:
      appointment?.id ||
      appointmentIdCandidates[0] ||
      null,
  };
}

export async function syncVerifiedPaymentToAppointment(args: {
  reference: string;
  provider: 'paystack' | 'payfast' | 'mock';
  state: PaymentVerificationState;
  amountCents?: number;
  currency?: string;
  raw?: Record<string, unknown> | null;
}) {
  const resolved =
    await resolvePaymentReference(args.reference);
  const appointment = resolved.appointment;
  const existingPayment = resolved.payment;

  if (!appointment && !existingPayment) {
    throw new Error(
      'payment_reference_not_linked_to_appointment',
    );
  }

  const expectedAmount =
    expectedAppointmentAmount(appointment) ??
    (
      Number.isFinite(Number(existingPayment?.amountCents))
        ? Math.round(Number(existingPayment.amountCents))
        : null
    );
  const expectedCurrency =
    expectedAppointmentCurrency(appointment) ||
    clean(existingPayment?.currency, 3).toUpperCase() ||
    null;
  const providerAmount =
    Number.isFinite(Number(args.amountCents))
      ? Math.round(Number(args.amountCents))
      : null;
  const providerCurrency =
    clean(args.currency, 3).toUpperCase() || null;

  const amountMismatch =
    args.state === 'captured' &&
    (
      expectedAmount == null ||
      providerAmount == null ||
      providerAmount !== expectedAmount
    );
  const currencyMismatch =
    args.state === 'captured' &&
    (
      !expectedCurrency ||
      !providerCurrency ||
      providerCurrency !== expectedCurrency
    );
  const effectiveState: PaymentVerificationState =
    amountMismatch || currencyMismatch
      ? 'failed'
      : args.state;
  const verifiedAt = new Date().toISOString();
  const verificationSnapshot = {
    provider: args.provider,
    requestedState: args.state,
    effectiveState,
    expectedAmountCents: expectedAmount,
    providerAmountCents: providerAmount,
    expectedCurrency,
    providerCurrency,
    amountMismatch,
    currencyMismatch,
    verifiedAt,
    raw: args.raw ?? null,
  };

  let payment = existingPayment;

  if (!payment) {
    if (!appointment) {
      throw new Error(
        'payment_appointment_not_found',
      );
    }

    payment = await prisma.payment.create({
      data: {
        id: randomId('pay'),
        encounterId: appointment.encounterId,
        caseId: appointment.caseId,
        amountCents: expectedAmount ?? 0,
        currency:
          expectedCurrency ||
          appointment.currency ||
          'ZAR',
        status: effectiveState,
        providerRef: args.reference,
        meta: jsonSafe({
          provider: args.provider,
          verification: verificationSnapshot,
          appointmentId: appointment.id,
        }),
        orgId: appointment.orgId || 'org-default',
      } as any,
    });
  } else {
    const paymentMeta = readMeta(payment.meta);

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: effectiveState,
        amountCents:
          expectedAmount ?? payment.amountCents,
        currency:
          expectedCurrency || payment.currency,
        meta: jsonSafe({
          ...paymentMeta,
          provider: args.provider,
          verification: verificationSnapshot,
          appointmentId:
            appointment?.id ||
            paymentMeta.appointmentId ||
            resolved.appointmentId ||
            null,
          verifiedAt,
        }),
      },
    });
  }

  let updatedAppointment = appointment;

  if (appointment) {
    const appointmentMeta =
      readMeta(appointment.meta);
    const nextPaymentStatus =
      toAppointmentPaymentStatus(effectiveState);
    const nextAppointmentStatus =
      effectiveState === 'captured' &&
      appointment.status === 'pending_payment'
        ? 'confirmed'
        : appointment.status;

    updatedAppointment =
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          paymentIntentId:
            payment.id,
          paymentProvider: args.provider,
          paymentRef: args.reference,
          paymentStatus: nextPaymentStatus,
          status: nextAppointmentStatus,
          confirmedAt:
            effectiveState === 'captured'
              ? appointment.confirmedAt || new Date()
              : appointment.confirmedAt,
          meta: jsonSafe({
            ...appointmentMeta,
            paymentVerification:
              verificationSnapshot,
          }),
        },
      });

    await prisma.appointmentAuditEvent
      .create({
        data: {
          appointmentId: appointment.id,
          action:
            amountMismatch || currencyMismatch
              ? 'payment_verification_rejected'
              : 'payment_verified',
          actorType: 'system',
          actorUserId: null,
          reason:
            amountMismatch
              ? 'payment_amount_mismatch'
              : currencyMismatch
                ? 'payment_currency_mismatch'
                : `payment_${effectiveState}`,
          beforeJson: {
            status: appointment.status,
            paymentStatus:
              appointment.paymentStatus,
            paymentProvider:
              appointment.paymentProvider,
            paymentRef:
              appointment.paymentRef,
          },
          afterJson: {
            status:
              updatedAppointment.status,
            paymentStatus:
              updatedAppointment.paymentStatus,
            paymentProvider:
              updatedAppointment.paymentProvider,
            paymentRef:
              updatedAppointment.paymentRef,
            verification:
              verificationSnapshot,
          },
          orgId:
            appointment.orgId || 'org-default',
        },
      })
      .catch(() => null);
  }

  return {
    appointment: updatedAppointment,
    payment,
    verification: verificationSnapshot,
  };
}
