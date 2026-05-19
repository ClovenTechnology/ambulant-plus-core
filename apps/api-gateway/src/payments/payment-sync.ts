import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppointmentPaymentStatus } from '@prisma/client';
import { prisma } from '@/src/lib/db';

export type PaymentVerificationState = 'captured' | 'pending' | 'failed';

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

function toAppointmentPaymentStatus(state: PaymentVerificationState): AppointmentPaymentStatus {
  if (state === 'captured') return AppointmentPaymentStatus.CAPTURED;
  if (state === 'pending') return AppointmentPaymentStatus.PENDING;
  return AppointmentPaymentStatus.FAILED;
}

export async function syncVerifiedPaymentToAppointment(args: {
  reference: string;
  provider: 'paystack' | 'payfast' | 'mock';
  state: PaymentVerificationState;
  amountCents?: number;
  currency?: string;
  raw?: Record<string, unknown> | null;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: { paymentRef: args.reference },
  });

  const existingPayment = await prisma.payment.findFirst({
    where: { providerRef: args.reference },
  });

  let payment = existingPayment;

  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        id: randomId('pay'),
        encounterId: appointment?.encounterId ?? null,
        caseId: appointment?.caseId ?? null,
        amountCents: args.amountCents ?? appointment?.priceCents ?? 0,
        currency: args.currency ?? appointment?.currency ?? 'ZAR',
        status:
          args.state === 'captured'
            ? 'captured'
            : args.state === 'pending'
              ? 'pending'
              : 'failed',
        providerRef: args.reference,
        meta: jsonSafe({
          provider: args.provider,
          verification: args.raw ?? null,
          appointmentId: appointment?.id ?? null,
        }),
      } as any,
    });
  } else {
    const meta = readMeta(payment.meta);

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:
          args.state === 'captured'
            ? 'captured'
            : args.state === 'pending'
              ? 'pending'
              : 'failed',
        amountCents:
          typeof args.amountCents === 'number' ? args.amountCents : payment.amountCents,
        currency: args.currency || payment.currency,
        meta: jsonSafe({
          ...meta,
          provider: args.provider,
          verification: args.raw ?? null,
          verifiedAt: new Date().toISOString(),
        }),
      },
    });
  }

  let updatedAppointment = appointment;

  if (appointment) {
    const apptMeta = readMeta(appointment.meta);
    const verifiedAt = new Date().toISOString();

    const nextPaymentStatus = toAppointmentPaymentStatus(args.state);
    const nextAppointmentStatus =
      args.state === 'captured' && appointment.status === 'pending_payment'
        ? 'confirmed'
        : appointment.status;

    updatedAppointment = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        paymentProvider: args.provider,
        paymentRef: args.reference,
        paymentStatus: nextPaymentStatus,
        status: nextAppointmentStatus,
        meta: jsonSafe({
          ...apptMeta,
          paymentVerification: {
            provider: args.provider,
            state: args.state,
            amountCents: args.amountCents ?? null,
            currency: args.currency ?? null,
            verifiedAt,
          },
        }),
      },
    });

    await prisma.appointmentAuditEvent
      .create({
        data: {
          appointmentId: appointment.id,
          action: 'payment_verified',
          actorType: 'system',
          actorUserId: null,
          reason: `payment_${args.state}`,
          beforeJson: {
            status: appointment.status,
            paymentStatus: appointment.paymentStatus,
            paymentProvider: appointment.paymentProvider,
            paymentRef: appointment.paymentRef,
          },
          afterJson: {
            status: updatedAppointment.status,
            paymentStatus: updatedAppointment.paymentStatus,
            paymentProvider: updatedAppointment.paymentProvider,
            paymentRef: updatedAppointment.paymentRef,
            provider: args.provider,
            state: args.state,
            amountCents: args.amountCents ?? null,
            currency: args.currency ?? null,
            verifiedAt,
          },
          orgId: appointment.orgId ?? 'org-default',
        },
      })
      .catch(() => null);
  }

  return { appointment: updatedAppointment, payment };
}