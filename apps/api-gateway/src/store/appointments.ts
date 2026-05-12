// apps/api-gateway/src/store/appointments.ts
import { prisma } from '@/src/lib/db';

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code || message;
  }
}

type JsonObject = Record<string, any>;

function asString(value: unknown, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function asNullableString(value: unknown) {
  const s = String(value ?? '').trim();
  return s || null;
}

function asCents(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function asDate(value: unknown, fallback?: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const d = new Date(String(value ?? ''));
  if (!Number.isNaN(d.getTime())) return d;

  if (fallback) return fallback;

  throw new HttpError('invalid_date', 422, 'invalid_date');
}

function normalizeCurrency(value: unknown, fallback = 'ZAR') {
  return asString(value, fallback).toUpperCase();
}

function normalizeMeta(value: unknown): JsonObject {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return { note: value };
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return {};
}

function mergeMeta(...values: unknown[]): JsonObject {
  return values.reduce<JsonObject>((acc, value) => {
    return { ...acc, ...normalizeMeta(value) };
  }, {});
}

function appointmentDelegate() {
  return (prisma as any).appointment;
}

function clinicianProfileDelegate() {
  return (prisma as any).clinicianProfile;
}

function clinicianFeeDelegate() {
  return (prisma as any).clinicianFee;
}

export async function getClinician(clinicianId: string) {
  if (!clinicianId) {
    throw new HttpError('clinician_id_required', 422, 'clinician_id_required');
  }

  const delegate = clinicianProfileDelegate();

  if (!delegate?.findFirst) {
    throw new HttpError('clinician_store_unavailable', 503, 'clinician_store_unavailable');
  }

  const clinician = await delegate.findFirst({
    where: {
      OR: [
        { id: clinicianId },
        { userId: clinicianId },
      ],
    },
  });

  if (!clinician) {
    throw new HttpError('clinician_not_found', 404, 'clinician_not_found');
  }

  const feeCents = asCents(
    clinician.feeCents ??
      clinician.consultationFeeCents ??
      clinician.standardFeeCents ??
      clinician.priceCents ??
      clinician.amountCents ??
      0,
  );

  return {
    ...clinician,
    id: clinician.id,
    userId: clinician.userId,
    clinicianId: clinician.id,
    name: clinician.displayName ?? clinician.name ?? 'Clinician',
    displayName: clinician.displayName ?? clinician.name ?? 'Clinician',
    currency: clinician.currency ?? 'ZAR',
    feeCents,
    amountCents: feeCents,
    priceCents: feeCents,
  };
}

export async function createAppointment(input: JsonObject = {}) {
  const delegate = appointmentDelegate();

  if (!delegate?.create) {
    throw new HttpError('appointment_store_unavailable', 503, 'appointment_store_unavailable');
  }

  const clinicianId = asString(input.clinicianId ?? input.clinician_id);
  const patientId = asString(input.patientId ?? input.patient_id);

  if (!clinicianId) {
    throw new HttpError('clinician_id_required', 422, 'clinician_id_required');
  }

  if (!patientId) {
    throw new HttpError('patient_id_required', 422, 'patient_id_required');
  }

  const startsAt = asDate(
    input.startsAt ?? input.startAt ?? input.start ?? input.slotStart,
    new Date(),
  );

  const endsAt = input.endsAt ?? input.endAt ?? input.end ?? input.slotEnd
    ? asDate(input.endsAt ?? input.endAt ?? input.end ?? input.slotEnd)
    : new Date(startsAt.getTime() + 30 * 60 * 1000);

  if (endsAt <= startsAt) {
    throw new HttpError('end_before_start', 422, 'end_before_start');
  }

  const meta = mergeMeta(input.meta, {
    roomId: input.roomId,
    reason: input.reason,
    source: input.source,
    patientName: input.patientName,
    clinicianName: input.clinicianName,
    appointmentType: input.appointmentType ?? input.type,
  });

  const data: JsonObject = {
    clinicianId,
    patientId,
    startsAt,
    endsAt,
    status: asString(input.status, 'pending'),
    meta,
  };

  // These are added conditionally and ignored only if your runtime schema accepts them.
  // They are kept because existing booking routes may rely on them.
  if (input.clientId !== undefined) data.clientId = asNullableString(input.clientId);
  if (input.clientMemberId !== undefined) data.clientMemberId = asNullableString(input.clientMemberId);
  if (input.coveragePlanId !== undefined) data.coveragePlanId = asNullableString(input.coveragePlanId);
  if (input.partnerId !== undefined) data.partnerId = asNullableString(input.partnerId);
  if (input.practiceId !== undefined) data.practiceId = asNullableString(input.practiceId);

  if (input.priceCents !== undefined || input.amountCents !== undefined) {
    data.priceCents = asCents(input.priceCents ?? input.amountCents);
  }

  if (input.platformFeeCents !== undefined) {
    data.platformFeeCents = asCents(input.platformFeeCents);
  }

  if (input.clinicianTakeCents !== undefined) {
    data.clinicianTakeCents = asCents(input.clinicianTakeCents);
  }

  if (input.currency !== undefined) {
    data.currency = normalizeCurrency(input.currency);
  }

  if (input.paymentProvider !== undefined) {
    data.paymentProvider = asNullableString(input.paymentProvider);
  }

  if (input.paymentRef !== undefined) {
    data.paymentRef = asNullableString(input.paymentRef);
  }

  try {
    return await delegate.create({ data });
  } catch (err: any) {
    // If optional columns are not present in a partially migrated DB/schema,
    // retry with the safest core appointment fields only.
    const message = String(err?.message || err);

    if (
      message.includes('Unknown argument') ||
      message.includes('Unknown field') ||
      message.includes('does not exist')
    ) {
      return delegate.create({
        data: {
          clinicianId,
          patientId,
          startsAt,
          endsAt,
          status: asString(input.status, 'pending'),
          meta,
        },
      });
    }

    throw err;
  }
}

export async function updateAppointment(id: string, patch: JsonObject = {}) {
  if (!id) {
    throw new HttpError('appointment_id_required', 422, 'appointment_id_required');
  }

  const delegate = appointmentDelegate();

  if (!delegate?.update || !delegate?.findUnique) {
    throw new HttpError('appointment_store_unavailable', 503, 'appointment_store_unavailable');
  }

  const data: JsonObject = {};

  if (patch.startsAt !== undefined) {
    data.startsAt = asDate(patch.startsAt);
  }

  if (patch.endsAt !== undefined) {
    data.endsAt = asDate(patch.endsAt);
  }

  if (patch.status !== undefined) {
    data.status = asString(patch.status);
  }

  if (patch.clinicianId !== undefined) {
    data.clinicianId = asString(patch.clinicianId);
  }

  if (patch.patientId !== undefined) {
    data.patientId = asString(patch.patientId);
  }

  if (patch.clientId !== undefined) {
    data.clientId = asNullableString(patch.clientId);
  }

  if (patch.clientMemberId !== undefined) {
    data.clientMemberId = asNullableString(patch.clientMemberId);
  }

  if (patch.coveragePlanId !== undefined) {
    data.coveragePlanId = asNullableString(patch.coveragePlanId);
  }

  if (patch.partnerId !== undefined) {
    data.partnerId = asNullableString(patch.partnerId);
  }

  if (patch.practiceId !== undefined) {
    data.practiceId = asNullableString(patch.practiceId);
  }

  if (patch.priceCents !== undefined) {
    data.priceCents = asCents(patch.priceCents);
  }

  if (patch.platformFeeCents !== undefined) {
    data.platformFeeCents = asCents(patch.platformFeeCents);
  }

  if (patch.clinicianTakeCents !== undefined) {
    data.clinicianTakeCents = asCents(patch.clinicianTakeCents);
  }

  if (patch.currency !== undefined) {
    data.currency = normalizeCurrency(patch.currency);
  }

  if (patch.paymentProvider !== undefined) {
    data.paymentProvider = asNullableString(patch.paymentProvider);
  }

  if (patch.paymentRef !== undefined) {
    data.paymentRef = asNullableString(patch.paymentRef);
  }

  if (patch.meta !== undefined || patch.reason !== undefined || patch.roomId !== undefined) {
    let currentMeta: JsonObject = {};

    try {
      const existing = await delegate.findUnique({
        where: { id },
        select: { meta: true },
      });

      currentMeta = normalizeMeta(existing?.meta);
    } catch {
      currentMeta = {};
    }

    data.meta = mergeMeta(currentMeta, patch.meta, {
      reason: patch.reason,
      roomId: patch.roomId,
    });
  }

  if (Object.keys(data).length === 0) {
    const existing = await delegate.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError('appointment_not_found', 404, 'appointment_not_found');
    }

    return existing;
  }

  try {
    return await delegate.update({
      where: { id },
      data,
    });
  } catch (err: any) {
    if (String(err?.code || '') === 'P2025') {
      throw new HttpError('appointment_not_found', 404, 'appointment_not_found');
    }

    const message = String(err?.message || err);

    if (
      message.includes('Unknown argument') ||
      message.includes('Unknown field') ||
      message.includes('does not exist')
    ) {
      const safeData: JsonObject = {};

      for (const key of ['startsAt', 'endsAt', 'status', 'clinicianId', 'patientId', 'meta']) {
        if (data[key] !== undefined) safeData[key] = data[key];
      }

      return delegate.update({
        where: { id },
        data: safeData,
      });
    }

    throw err;
  }
}

export async function setClinicianFee(
  clinicianId: string,
  feeOrInput:
    | number
    | {
        feeCents?: number;
        amountCents?: number;
        priceCents?: number;
        currency?: string;
        kind?: string;
        label?: string;
        active?: boolean;
        [key: string]: any;
      },
  currencyArg?: string,
) {
  if (!clinicianId) {
    throw new HttpError('clinician_id_required', 422, 'clinician_id_required');
  }

  const input =
    typeof feeOrInput === 'object' && feeOrInput !== null
      ? feeOrInput
      : { feeCents: feeOrInput, currency: currencyArg };

  const feeCents = asCents(
    input.feeCents ??
      input.amountCents ??
      input.priceCents ??
      0,
  );

  const currency = normalizeCurrency(input.currency || currencyArg);
  const kind = asString(input.kind, 'standard');
  const label = asString(input.label, kind);
  const active = input.active ?? true;

  const profileDelegate = clinicianProfileDelegate();
  const feeDelegate = clinicianFeeDelegate();

  if (profileDelegate?.updateMany) {
    await profileDelegate
      .updateMany({
        where: {
          OR: [
            { id: clinicianId },
            { userId: clinicianId },
          ],
        },
        data: {
          feeCents,
          currency,
        },
      })
      .catch(() => null);
  }

  if (feeDelegate?.upsert) {
    try {
      return await feeDelegate.upsert({
        where: {
          clinicianId_kind: {
            clinicianId,
            kind,
          },
        },
        update: {
          label,
          amountCents: feeCents,
          currency,
          active,
        },
        create: {
          clinicianId,
          kind,
          label,
          amountCents: feeCents,
          currency,
          active,
        },
      });
    } catch {
      // Fall through to compatibility return.
    }
  }

  return {
    clinicianId,
    kind,
    label,
    feeCents,
    amountCents: feeCents,
    currency,
    active,
  };
}

export async function listAppointments(opts: JsonObject = {}) {
  const delegate = appointmentDelegate();

  if (!delegate?.findMany) return [];

  const where: JsonObject = {};

  if (opts.patientId) where.patientId = String(opts.patientId);
  if (opts.clinicianId) where.clinicianId = String(opts.clinicianId);
  if (opts.status) where.status = String(opts.status);

  return delegate.findMany({
    where,
    orderBy: { startsAt: 'desc' },
  });
}

export async function getAppointment(id: string) {
  if (!id) return null;

  const delegate = appointmentDelegate();

  if (!delegate?.findUnique) return null;

  return delegate.findUnique({
    where: { id },
  });
}