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

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function toAppointmentPaymentStatus(state: PaymentVerificationState): AppointmentPaymentStatus {
  if (state === 'captured') return AppointmentPaymentStatus.CAPTURED;
  if (state === 'pending') return AppointmentPaymentStatus.PENDING;
  return AppointmentPaymentStatus.FAILED;
}

export function extractAppointmentIdFromPaymentReference(reference: string) {
  const ref = clean(reference, 320);
  const match = ref.match(/(?:^|_)(appt-[A-Za-z0-9-]+)(?:_|$)/);
  return match?.[1] || null;
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((v) => clean(v, 240))
        .filter(Boolean),
    ),
  );
}

export async function resolvePaymentReference(reference: string) {
  const ref = clean(reference, 320);

  if (!ref) {
    return {
      appointment: null as any,
      payment: null as any,
      appointmentId: null as string | null,
    };
  }

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { providerRef: ref },
        { id: ref },
      ],
    },
  }).catch(() => null);

  const paymentMeta = readMeta(payment?.meta);

  const appointmentIdCandidates = uniq([
    paymentMeta.appointmentId,
    paymentMeta.appointment_id,
    paymentMeta.appointment?.id,
    extractAppointmentIdFromPaymentReference(ref),
  ]);

  const appointmentOr: any[] = [
    { paymentRef: ref },
  ];

  for (const id of appointmentIdCandidates) {
    appointmentOr.push({ id });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { OR: appointmentOr },
  }).catch(() => null);

  return {
    appointment,
    payment,
    appointmentId: appointment?.id ?? appointmentIdCandidates[0] ?? null,
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
  const resolved = await resolvePaymentReference(args.reference);
  const appointment = resolved.appointment;
  const existingPayment = resolved.payment;

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
          appointmentId: appointment?.id ?? resolved.appointmentId ?? null,
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
          appointmentId: appointment?.id ?? meta.appointmentId ?? resolved.appointmentId ?? null,
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