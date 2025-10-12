// apps/api-gateway/src/store/appointments.ts
import { prisma } from '@/src/lib/db';

/**
 * Simple HTTP-aware error so upper layers can map to proper status codes.
 */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

const FALLBACK_CLINICIANS: Record<string, { id: string; name: string; feeCents: number; currency: string }> = {
  'clin-za-001': { id: 'clin-za-001', name: 'Dr Z A', feeCents: 60000, currency: 'ZAR' },
  'clin-za-002': { id: 'clin-za-002', name: 'Dr Z B', feeCents: 55000, currency: 'ZAR' },
  'doctor-12'  : { id: 'doctor-12',  name: 'Dr Twelve', feeCents: 65000, currency: 'ZAR' },
};

export async function getClinician(id: string) {
  const clin = await prisma.clinicianProfile.findUnique({ where: { userId: id } });
  if (clin) {
    return {
      id: clin.userId,
      name: clin.displayName || clin.userId,
      feeCents: clin.feeCents ?? 60000,
      currency: clin.currency ?? 'ZAR',
    };
  }
  return FALLBACK_CLINICIANS[id] ?? null;
}

/**
 * createAppointment: safer creation with conflict checks and meta handling
 *
 * Expected input shape (typical):
 * {
 *   encounterId, sessionId, caseId, clinicianId, patientId,
 *   startsAt, endsAt,
 *   priceCents, currency, platformFeeCents, clinicianTakeCents,
 *   paymentProvider, paymentRef,
 *   roomId?,
 *   reason?,           // <- will be moved into meta, NOT stored top-level
 *   meta?              // object or JSON-string; will be merged with reason/roomId and stringified
 * }
 *
 * Throws HttpError on conflict (status 409) or invalid input (422).
 */
export async function createAppointment(input: any) {
  // Basic validation
  if (!input || !input.startsAt || !input.endsAt || !input.patientId || !input.clinicianId || !input.encounterId) {
    throw new HttpError('invalid_input', 422);
  }

  // normalize starts/ends to Date objects or ISO strings acceptable by Prisma
  const startsAt = input.startsAt;
  const endsAt = input.endsAt;

  // Conflict checks to avoid double-booking
  // clinician overlap
  const overlappingClinician = await prisma.appointment.findFirst({
    where: {
      clinicianId: input.clinicianId,
      status: { not: 'cancelled' },
      AND: [
        { startsAt: { lt: endsAt } },
        { endsAt: { gt: startsAt } },
      ],
    },
  });
  if (overlappingClinician) {
    throw new HttpError('clinician_unavailable', 409);
  }

  // patient overlap
  const overlappingPatient = await prisma.appointment.findFirst({
    where: {
      patientId: input.patientId,
      status: { not: 'cancelled' },
      AND: [
        { startsAt: { lt: endsAt } },
        { endsAt: { gt: startsAt } },
      ],
    },
  });
  if (overlappingPatient) {
    throw new HttpError('patient_unavailable', 409);
  }

  // ensure meta is serialized if Prisma model expects a String
  // If input.meta is a string, try to parse it; if parse fails, treat as raw string and include it.
  let metaObj: Record<string, any> = {};
  if (input.meta) {
    if (typeof input.meta === 'string') {
      try {
        metaObj = JSON.parse(input.meta);
      } catch {
        // it's a plain string; preserve as field
        metaObj = { raw: input.meta };
      }
    } else if (typeof input.meta === 'object') {
      metaObj = { ...input.meta };
    }
  }

  // Put reason and roomId inside meta (but do not store reason at top-level)
  if (input.reason !== undefined) metaObj.reason = input.reason;
  if (input.roomId !== undefined) metaObj.roomId = input.roomId;

  const metaString = JSON.stringify(metaObj);

  // Build create data WITHOUT top-level "reason"
  const data = {
    encounterId: input.encounterId,
    sessionId: input.sessionId,
    caseId: input.caseId,
    clinicianId: input.clinicianId,
    patientId: input.patientId,
    startsAt: startsAt,
    endsAt: endsAt,
    roomId: input.roomId ?? null,
    status: input.status ?? 'scheduled',
    priceCents: input.priceCents ?? 0,
    currency: input.currency ?? 'ZAR',
    platformFeeCents: input.platformFeeCents ?? 0,
    clinicianTakeCents: input.clinicianTakeCents ?? 0,
    paymentProvider: input.paymentProvider ?? null,
    paymentRef: input.paymentRef ?? null,
    meta: metaString,
  };

  // Create appointment
  const appt = await prisma.appointment.create({ data });
  return appt;
}

export async function updateAppointment(id: string, data: any) {
  return prisma.appointment.update({ where: { id }, data });
}

export async function findAppointmentByPaymentRef(paymentRef: string) {
  return prisma.appointment.findFirst({ where: { paymentRef } });
}
