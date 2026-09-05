// apps/api-gateway/app/api/appointments/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  MultiCareBookingError,
  assertMultiCarePriceLock,
  findMultiCareConflicts,
  resolveAuthorizedCareRecipients,
  resolveMultiCareQuote,
  verifyMultiCarePriceLock,
} from '@/src/appointments/multi-care';
import {
  AvailabilityError,
  validateAvailabilityInterval,
} from '@/src/availability/resolver';
import {
  bookingIntentId,
  bookingSlotKey,
  bookingStateForAppointment,
  computeBookingHoldExpiresAt,
  lockClinicianBookingLane,
  sha256Hex as reservationSha256Hex,
} from '@/src/appointments/booking-reservation';
import {
  normalizeBookingFundingMethod,
  previewBookingFunding,
} from '@/src/appointments/booking-funding';
import { createCoverageAuthorization } from '@ambulant/client-core/src/authorizations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-request-id,idempotency-key,x-idempotency-key',
    'cache-control': 'no-store',
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(),
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
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
    throw new MultiCareBookingError(
      'idempotency_key_required',
      428,
    );
  }

  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(value)) {
    throw new MultiCareBookingError(
      'invalid_idempotency_key',
      400,
    );
  }

  return value;
}

function deterministicId(
  prefix: string,
  ...components: string[]
) {
  return `${prefix}-${sha256Hex(components.join('\u0000')).slice(0, 32)}`;
}

function bookingRequestFingerprint(value: {
  clinicianId: string;
  hostUserId: string;
  actorPatientId: string;
  startsAt: Date;
  requestedEndsAt: Date;
  finalEndsAt: Date;
  appointmentKind: string;
  paymentMethod: string | null;
  recipientIds: string[];
  relationshipIds: Array<string | null>;
  totalAmountMinor: number;
  currency: string;
  policyId: string | null;
  policyVersion: number | null;
}) {
  return sha256Hex(
    JSON.stringify({
      clinicianId: value.clinicianId,
      hostUserId: value.hostUserId,
      actorPatientId: value.actorPatientId,
      startsAt: value.startsAt.toISOString(),
      requestedEndsAt: value.requestedEndsAt.toISOString(),
      finalEndsAt: value.finalEndsAt.toISOString(),
      appointmentKind: value.appointmentKind,
      paymentMethod: value.paymentMethod,
      recipientIds: [...value.recipientIds].sort(),
      relationshipIds: [...value.relationshipIds]
        .map((item) => item || '')
        .sort(),
      totalAmountMinor: value.totalAmountMinor,
      currency: value.currency,
      policyId: value.policyId,
      policyVersion: value.policyVersion,
    }),
  );
}

function cents(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function dateFrom(value: unknown) {
  const d = new Date(String(value || ''));
  return Number.isFinite(d.getTime()) ? d : null;
}

async function revalidateSelectedAvailabilitySlot(args: {
  req: NextRequest;
  clinicianId: string;
  patientId: string;
  hostUserId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  caseId: string;
}) {
  try {
    const validation = await validateAvailabilityInterval({
      clinicianRef: args.clinicianId,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      consultType: args.kind,
      caseId: args.caseId || null,
      allowExtendedDuration: false,
      enforceBookability: true,
      enforceAdvanceWindow: true,
      enforceConflicts: true,
    });

    const slot = {
      start: args.startsAt.toISOString(),
      end: args.endsAt.toISOString(),
      localStart: validation.localStart,
      localEnd: validation.localEnd,
      localDate: validation.localDate,
      localStartTime: validation.localStartTime,
      localEndTime: validation.localEndTime,
      localTimeLabel: validation.localTimeLabel,
      timezone: validation.timezone,
      status: validation.status,
      reason: validation.reason,
      consultType: validation.consultType,
      feeCents: validation.feeCents,
      currency: validation.currency,
      durationMin: validation.canonicalDurationMin,
      bufferMin: validation.bufferMin,
    };

    const availabilityMeta = {
      source: 'api_gateway_canonical_availability_v1',
      clinicianId: validation.contract.clinicianId,
      clinicianUserId:
        validation.contract.clinicianUserId,
      timezone: validation.contract.timezone,
      schedule: {
        matched: Boolean(
          validation.contract.scheduleMatchedUserId,
        ),
        matchedUserId:
          validation.contract.scheduleMatchedUserId,
      },
      sources: validation.contract.sources,
    };

    if (
      validation.consultType === 'followup' &&
      !args.caseId
    ) {
      return {
        ok: false,
        status: 400,
        error: 'followup_case_required',
        details: {
          slot,
          availabilityMeta,
        },
      };
    }

    return {
      ok: true,
      status: 200,
      slot,
      availabilityMeta,
    };
  } catch (error: any) {
    if (error instanceof AvailabilityError) {
      const mappedCode =
        error.code === 'interval_not_bookable'
          ? 'selected_slot_not_bookable'
          : 'selected_slot_not_in_current_availability';

      return {
        ok: false,
        status: error.status,
        error: mappedCode,
        details: {
          canonicalAvailabilityError: error.code,
          availabilityDetails: error.details,
        },
      };
    }

    throw error;
  }
}

async function validateExpandedAvailabilityInterval(args: {
  clinicianId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  caseId: string | null;
}) {
  try {
    return await validateAvailabilityInterval({
      clinicianRef: args.clinicianId,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      consultType: args.kind,
      caseId: args.caseId,
      allowExtendedDuration: true,
      enforceBookability: false,
      enforceAdvanceWindow: false,
      enforceConflicts: false,
    });
  } catch (error: any) {
    if (error instanceof AvailabilityError) {
      throw new MultiCareBookingError(
        'expanded_interval_outside_clinician_availability',
        error.status,
        {
          canonicalAvailabilityError: error.code,
          details: error.details,
          startsAt: args.startsAt.toISOString(),
          endsAt: args.endsAt.toISOString(),
        },
      );
    }

    throw error;
  }
}

function isSimulationAppointment(item: any) {
  const ids = [item?.id, item?.encounterId, item?.patientId, item?.roomId];
  if (ids.filter(Boolean).some((v) => String(v).startsWith('sim-') || String(v).startsWith('simulation-'))) {
    return true;
  }

  const source = String(item?.bookingSource || item?.meta?.source || '').toLowerCase();
  return source.includes('simulation') || item?.meta?.simulation === true;
}

function appOrigin(req: NextRequest, envKeys: string[], fallback: string) {
  for (const key of envKeys) {
    const v = clean(process.env[key]);
    if (v) return v.replace(/\/+$/, '');
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  if (host.includes('api') || host.includes('gateway')) return fallback;
  return host ? proto + '://' + host : fallback;
}

function buildJoinUrl(origin: string, roomId: string, params: Record<string, string | null | undefined>) {
  const url = new URL(origin.replace(/\/+$/, '') + '/sfu/' + encodeURIComponent(roomId));
  Object.entries(params).forEach(([key, value]) => {
    const v = clean(value);
    if (v) url.searchParams.set(key, v);
  });
  return url.toString();
}

function uniqueClean(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((v) => clean(v))
        .filter(Boolean),
    ),
  );
}

function patientDisplay(profile: any, fallback: unknown) {
  return (
    clean(profile?.name) ||
    clean(profile?.displayName) ||
    clean(profile?.fullName) ||
    clean(fallback) ||
    'Patient'
  );
}

function clinicianDisplay(profile: any, fallback: unknown) {
  return (
    clean(profile?.displayName) ||
    clean(profile?.name) ||
    clean(profile?.email) ||
    clean(fallback) ||
    'Clinician'
  );
}

function shapeAppointment(
  item: any,
  visitByAppt: Map<string, any>,
  clinicianById = new Map<string, any>(),
  patientById = new Map<string, any>(),
) {
  const visit = visitByAppt.get(String(item.id));
  const meta = item?.meta && typeof item.meta === 'object' ? item.meta : {};

  const subjectId = item.subjectPatientId || item.patientId;
  const patient =
    patientById.get(String(subjectId || '')) ||
    patientById.get(String(item.patientId || '')) ||
    null;

  const clinician = clinicianById.get(String(item.clinicianId || '')) || null;

  const roomId = item.roomId ?? visit?.roomId ?? meta.roomId ?? null;
  const patientName = clean(meta.patientDisplayName) || patientDisplay(patient, subjectId || item.patientId);
  const clinicianName = clean(meta.clinicianDisplayName) || clinicianDisplay(clinician, item.clinicianId);

  return {
    ...item,
    appointmentId: item.id,
    startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : item.startsAt,
    endsAt: item.endsAt instanceof Date ? item.endsAt.toISOString() : item.endsAt,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    visitId: visit?.id ?? meta.visitId ?? null,
    televisitId: visit?.id ?? meta.televisitId ?? null,
    roomId,
    patientJoinUrl: meta.patientJoinUrl ?? null,
    clinicianJoinUrl: meta.clinicianJoinUrl ?? null,
    patientParticipantId: meta.patientParticipantId ?? (item.patientId ? 'pat-' + item.patientId : null),
    clinicianParticipantId: meta.clinicianParticipantId ?? (item.clinicianId ? 'clin-' + item.clinicianId : null),

    patientName,
    patientDisplayName: patientName,
    patientAvatarUrl: patient?.photoUrl ?? meta.patientAvatarUrl ?? null,
    patientGender: patient?.gender ?? null,
    patientDob: patient?.dob instanceof Date ? patient.dob.toISOString() : patient?.dob ?? null,

    clinicianName,
    clinicianDisplayName: clinicianName,
    clinicianSpecialty: clinician?.specialty ?? meta.clinicianSpecialty ?? null,
    clinicianAvatarUrl: clinician?.photoUrl ?? meta.clinicianAvatarUrl ?? null,
    clinicianGender: clinician?.gender ?? null,
    clinicianLocation:
      clean(clinician?.city) ||
      clean(clinician?.practiceName) ||
      clean(clinician?.country) ||
      null,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);

    const url = new URL(req.url);
    const excludeSimulation =
      url.searchParams.get('excludeSimulation') === '1' ||
      url.searchParams.get('production') === '1' ||
      url.searchParams.get('production-check') === '1';

    const where: any = {};
    const role = clean(who.role, 80).toLowerCase();

    if (role === 'patient') {
      const actorPatientId = clean(who.actorRefId);
      const hostUserId = clean(who.uid);

      if (!actorPatientId || !hostUserId) {
        return json(
          { ok: false, error: 'patient_identity_required' },
          401,
        );
      }

      where.OR = [
        { hostUserId },
        { patientId: actorPatientId },
        { subjectPatientId: actorPatientId },
        {
          careRecipients: {
            some: { patientId: actorPatientId },
          },
        },
      ];
    } else if (
      role === 'clinician' ||
      role === 'clinician_staff_medical' ||
      role === 'clinician_staff_non_medical'
    ) {
      const identityRefs = uniqueClean([
        who.actorRefId,
        who.uid,
      ]);
      const clinician = await prisma.clinicianProfile.findFirst({
        where: {
          OR: identityRefs.flatMap((identityRef) => [
            { id: identityRef },
            { userId: identityRef },
          ]),
        },
        select: { id: true },
      });

      if (!clinician) {
        return json(
          { ok: false, error: 'clinician_identity_required' },
          401,
        );
      }

      where.clinicianId = clinician.id;
    } else if (
      role === 'admin' ||
      role === 'admin_staff' ||
      role === 'system'
    ) {
      const clinicianId =
        clean(url.searchParams.get('clinicianId')) || undefined;
      const patientId =
        clean(url.searchParams.get('patientId')) || undefined;
      const subjectPatientId =
        clean(url.searchParams.get('subjectPatientId')) || undefined;

      if (clinicianId) where.clinicianId = clinicianId;

      const patientScope: any[] = [];
      if (patientId) {
        patientScope.push(
          { patientId },
          { hostUserId: patientId },
          {
            careRecipients: {
              some: { patientId },
            },
          },
        );
      }
      if (subjectPatientId) {
        patientScope.push({ subjectPatientId });
      }
      if (patientScope.length > 0) where.OR = patientScope;
    } else {
      return json(
        { ok: false, error: 'forbidden' },
        403,
      );
    }

    const from = dateFrom(
      url.searchParams.get('from') ||
        url.searchParams.get('dateFrom'),
    );
    const to = dateFrom(
      url.searchParams.get('to') ||
        url.searchParams.get('dateTo'),
    );

    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = from;
      if (to) where.startsAt.lt = to;
    }

    const rawItems = await prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      take: 300,
    });

    const filtered = excludeSimulation
      ? rawItems.filter((item) => !isSimulationAppointment(item))
      : rawItems;

    const visitRows = filtered.length
      ? await prisma.televisit.findMany({
          where: {
            appointmentId: {
              in: filtered.map((item) => item.id),
            },
          },
        })
      : [];

    const clinicianIds = uniqueClean(
      filtered.map((item) => item.clinicianId),
    );
    const patientIds = uniqueClean(
      filtered.flatMap((item) => [
        item.patientId,
        item.subjectPatientId,
        item.hostUserId,
      ]),
    );

    const [clinicianRows, patientRows] = await Promise.all([
      clinicianIds.length
        ? prisma.clinicianProfile.findMany({
            where: { id: { in: clinicianIds } },
            select: {
              id: true,
              userId: true,
              displayName: true,
              specialty: true,
              gender: true,
              photoUrl: true,
              city: true,
              country: true,
              practiceName: true,
              email: true,
            },
          })
        : Promise.resolve([]),
      patientIds.length
        ? prisma.patientProfile.findMany({
            where: {
              OR: [
                { id: { in: patientIds } },
                { userId: { in: patientIds } },
              ],
            },
            select: {
              id: true,
              userId: true,
              name: true,
              gender: true,
              dob: true,
              photoUrl: true,
              contactEmail: true,
              phone: true,
              city: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const visitByAppt = new Map(
      visitRows.map((visit) => [
        String(visit.appointmentId),
        visit,
      ]),
    );
    const clinicianById = new Map(
      clinicianRows.map((clinician) => [
        String(clinician.id),
        clinician,
      ]),
    );
    const patientById = new Map<string, any>();

    for (const patient of patientRows as any[]) {
      patientById.set(String(patient.id), patient);
      if (patient.userId) {
        patientById.set(String(patient.userId), patient);
      }
    }

    const items = filtered.map((item) =>
      shapeAppointment(
        item,
        visitByAppt,
        clinicianById,
        patientById,
      ),
    );

    return json({
      ok: true,
      appointments: items,
      items,
      total: items.length,
    });
  } catch (error: any) {
    console.error(
      '[api-gateway][appointments.GET] error',
      error,
    );

    const message = String(
      error?.message || 'appointments_load_failed',
    );
    const lowerMessage = message.toLowerCase();
    const status =
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('untrusted')
        ? 401
        : 500;

    return json(
      { ok: false, error: message },
      status,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);

    if (who.role !== 'patient' || !who.uid || !who.actorRefId) {
      throw new MultiCareBookingError(
        'patient_identity_required',
        401,
      );
    }

    const idempotencyKey = normalizeIdempotencyKey(req);
    const body = await req.json().catch(() => ({} as any));

    const clinicianRef = clean(
      body.clinicianId ||
        body.clinician_id ||
        body.providerId ||
        body.provider_id,
    );

    const actorPatientId = clean(who.actorRefId);

    if (!clinicianRef) {
      return json({ ok: false, error: 'clinicianId_required' }, 400);
    }

    if (!actorPatientId) {
      return json(
        { ok: false, error: 'patient_identity_required' },
        401,
      );
    }

    const hostUserId = clean(who.uid);
    const fallbackSubjectPatientId = clean(
      body.subjectPatientId ||
        body.subject_patient_id ||
        body.person?.subjectPatientId ||
        actorPatientId,
    );

    const startsAt = dateFrom(
      body.startsAt ||
        body.starts_at ||
        body.start ||
        body.startTime,
    );

    if (!startsAt) {
      return json({ ok: false, error: 'startsAt_required' }, 400);
    }

    const requestedDurationMin = Math.max(
      5,
      Math.min(
        240,
        Number(
          body.durationMin ||
            body.durationMinutes ||
            body.duration_min ||
            30,
        ) || 30,
      ),
    );

    const requestedEndsAt =
      dateFrom(
        body.endsAt ||
          body.ends_at ||
          body.end ||
          body.endTime,
      ) ||
      new Date(
        startsAt.getTime() +
          requestedDurationMin * 60_000,
      );

    if (requestedEndsAt <= startsAt) {
      return json(
        { ok: false, error: 'invalid_time_range' },
        400,
      );
    }

    const appointmentKind =
      clean(body.kind).toUpperCase() === 'FOLLOWUP'
        ? 'FOLLOWUP'
        : 'STANDARD';
    const requestedCaseId = clean(
      body.caseId || body.case_id,
    );

    const joinClosesAtPreview = new Date(
      requestedEndsAt.getTime() + 60 * 60 * 1000,
    );

    if (
      joinClosesAtPreview.getTime() <=
      Date.now() + 30_000
    ) {
      return json(
        {
          ok: false,
          error: 'appointment_window_expired',
          message:
            'This slot is no longer available. Please choose a future slot.',
          startsAt: startsAt.toISOString(),
          endsAt: requestedEndsAt.toISOString(),
          joinClosesAt:
            joinClosesAtPreview.toISOString(),
        },
        400,
      );
    }

    const clinician = await prisma.clinicianProfile.findFirst({
      where: {
        OR: [
          { id: clinicianRef },
          { userId: clinicianRef },
        ],
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        specialty: true,
        gender: true,
        photoUrl: true,
        city: true,
        country: true,
        practiceName: true,
        feeCents: true,
        currency: true,
        status: true,
        disabled: true,
        archived: true,
      },
    });

    if (!clinician) {
      return json(
        { ok: false, error: 'unknown_clinician' },
        404,
      );
    }

    if (
      clinician.disabled ||
      clinician.archived ||
      String(clinician.status || '').toLowerCase() !==
        'active'
    ) {
      return json(
        { ok: false, error: 'clinician_not_bookable' },
        409,
      );
    }

    const slotRevalidation: any =
      await revalidateSelectedAvailabilitySlot({
        req,
        clinicianId: clinician.id,
        patientId: actorPatientId,
        hostUserId,
        startsAt,
        endsAt: requestedEndsAt,
        kind: appointmentKind,
        caseId: requestedCaseId,
      });

    if (!slotRevalidation.ok) {
      return json(
        {
          ok: false,
          error: slotRevalidation.error,
          details: slotRevalidation.details || null,
        },
        slotRevalidation.status || 409,
      );
    }

    const validatedSlot =
      slotRevalidation.slot || {};
    const availabilityMeta =
      slotRevalidation.availabilityMeta || null;

    const recipients =
      await resolveAuthorizedCareRecipients({
        rawRecipients:
          body.careRecipients ||
          body.care_recipients,
        actorPatientId,
        hostUserId,
        fallbackSubjectPatientId,
        fallbackRelationshipId:
          clean(
            body.familyRelationshipId ||
              body.family_relationship_id ||
              body.person?.relationshipId,
          ) || null,
        fallbackCaseId:
          requestedCaseId || null,
      });

    if (
      appointmentKind === 'FOLLOWUP' &&
      recipients.some((recipient) => !recipient.caseId)
    ) {
      throw new MultiCareBookingError(
        'followup_case_required_for_each_care_recipient',
        400,
      );
    }

    const baseAmountMinor = cents(
      validatedSlot.feeCents,
      clinician.feeCents || 0,
    );
    const currency =
      clean(
        validatedSlot.currency ||
          clinician.currency ||
          'ZAR',
        3,
      ).toUpperCase() || 'ZAR';
    const baseDurationMin = Math.max(
      5,
      Number(
        validatedSlot.durationMin ||
          Math.round(
            (
              requestedEndsAt.getTime() -
              startsAt.getTime()
            ) /
              60_000,
          ),
      ) || requestedDurationMin,
    );

    const quote = await resolveMultiCareQuote({
      clinicianUserId: clean(
        clinician.userId || clinician.id,
      ),
      recipients,
      feeKind: appointmentKind,
      visitMode: 'televisit',
      baseAmountMinor,
      currency,
      baseDurationMin,
    });

    const finalEndsAt = new Date(
      startsAt.getTime() +
        quote.durationMin * 60_000,
    );

    await validateExpandedAvailabilityInterval({
      clinicianId: clinician.id,
      startsAt,
      endsAt: finalEndsAt,
      kind: appointmentKind,
      caseId: requestedCaseId || null,
    });

    const suppliedPriceLock =
      typeof body.priceLock === 'string'
        ? body.priceLock
        : typeof body.price_lock === 'string'
          ? body.price_lock
          : body.priceLock?.token ||
            body.price_lock?.token;

    if (!suppliedPriceLock) {
      throw new MultiCareBookingError(
        'price_lock_required',
        409,
      );
    }

    const lockPayload =
      verifyMultiCarePriceLock(suppliedPriceLock);

    assertMultiCarePriceLock({
      payload: lockPayload,
      clinicianId: clinician.id,
      hostUserId,
      actorPatientId,
      startsAt,
      requestedEndsAt,
      finalEndsAt,
      quote,
      recipientIds: recipients.map(
        (recipient) => recipient.patientId,
      ),
    });

    const paymentMethod = normalizeBookingFundingMethod(
      body.paymentMethod || body.payment_method || 'CARD',
    );

    const appointmentId = deterministicId(
      'appt',
      hostUserId,
      idempotencyKey,
    );
    const requestFingerprint = bookingRequestFingerprint({
      clinicianId: clinician.id,
      hostUserId,
      actorPatientId,
      startsAt,
      requestedEndsAt,
      finalEndsAt,
      appointmentKind,
      paymentMethod,
      recipientIds: recipients.map(
        (recipient) => recipient.patientId,
      ),
      relationshipIds: recipients.map(
        (recipient) => recipient.familyRelationshipId,
      ),
      totalAmountMinor: quote.totalAmountMinor,
      currency: quote.currency,
      policyId: quote.policy?.id || null,
      policyVersion: quote.policy?.version ?? null,
    });

    const existingAppointment =
      await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

    if (existingAppointment) {
      const existingMeta = readMeta(existingAppointment.meta);
      const existingIntegrity = readMeta(
        existingMeta.bookingIntegrity,
      );

      if (
        clean(existingIntegrity.requestFingerprint, 128) !==
        requestFingerprint
      ) {
        throw new MultiCareBookingError(
          'idempotency_key_reused_with_different_booking',
          409,
        );
      }

      const [existingVisit, existingRecipients] =
        await Promise.all([
          prisma.televisit.findFirst({
            where: {
              appointmentId: existingAppointment.id,
            },
          }),
          (prisma as any).appointmentCareRecipient.findMany({
            where: {
              appointmentId: existingAppointment.id,
            },
            orderBy: { sequence: 'asc' },
          }),
        ]);

      const existingBooking =
        await bookingStateForAppointment(existingAppointment.id);

      const replayAppointment = {
        ...existingAppointment,
        startsAt:
          existingAppointment.startsAt.toISOString(),
        endsAt:
          existingAppointment.endsAt.toISOString(),
        createdAt:
          existingAppointment.createdAt.toISOString(),
        updatedAt:
          existingAppointment.updatedAt.toISOString(),
        visitId: existingVisit?.id || null,
        televisitId: existingVisit?.id || null,
        roomId:
          existingAppointment.roomId ||
          existingVisit?.roomId ||
          null,
        clinicianJoinUrl:
          existingMeta.clinicianJoinUrl || null,
        patientJoinUrl:
          existingMeta.patientJoinUrl || null,
        clinicianParticipantId:
          existingMeta.clinicianParticipantId || null,
        patientParticipantId:
          existingMeta.patientParticipantId || null,
        patientName:
          existingMeta.patientDisplayName || null,
        patientDisplayName:
          existingMeta.patientDisplayName || null,
        patientAvatarUrl:
          existingMeta.patientAvatarUrl || null,
        clinicianName:
          existingMeta.clinicianDisplayName || null,
        clinicianDisplayName:
          existingMeta.clinicianDisplayName || null,
        clinicianAvatarUrl:
          existingMeta.clinicianAvatarUrl || null,
        clinicianSpecialty:
          existingMeta.clinicianSpecialty || null,
        clinicianLocation:
          existingMeta.clinicianLocation || null,
        multiCare:
          existingMeta.multiCare || null,
      };

      return json(
        {
          ok: true,
          idempotentReplay: true,
          appointment: replayAppointment,
          appointmentId: existingAppointment.id,
          appointment_id: existingAppointment.id,
          encounterId: existingAppointment.encounterId,
          encounter_id: existingAppointment.encounterId,
          encounterIds: existingRecipients
            .map((recipient: any) => recipient.encounterId)
            .filter(Boolean),
          visitId: existingVisit?.id || null,
          televisitId: existingVisit?.id || null,
          roomId:
            existingAppointment.roomId ||
            existingVisit?.roomId ||
            null,
          clinicianJoinUrl:
            existingMeta.clinicianJoinUrl || null,
          patientJoinUrl:
            existingMeta.patientJoinUrl || null,
          paymentStatus:
            existingAppointment.paymentStatus,
          status: existingAppointment.status,
          multiCare: existingMeta.multiCare || null,
          booking: existingBooking,
        },
        200,
      );
    }

    const orgId = clean(who.orgId) || 'org-default';
    const fundingPreview = await previewBookingFunding({
      method: paymentMethod,
      patientId: recipients[0].patientId,
      clinicianUserId: clean(clinician.userId || clinician.id),
      clinicianId: clinician.id,
      hostUserId,
      kind: appointmentKind,
      totalAmountMinor: quote.totalAmountMinor,
      currency: quote.currency,
      orgId,
      clientId: clean(body.clientId || body.client_id) || undefined,
      voucherCode: clean(body.voucherCode || body.voucher_code, 160) || undefined,
    });

    if (quote.multiCare && paymentMethod !== 'CARD') {
      throw new MultiCareBookingError(
        'multi_care_non_card_funding_requires_individual_coverage_review',
        409,
      );
    }

    if (!fundingPreview.canProceed) {
      return json(
        {
          ok: false,
          error: 'funding_preflight_blocked',
          funding: fundingPreview,
          message: fundingPreview.reason,
        },
        409,
      );
    }

    const conflicts = await findMultiCareConflicts({
      clinicianId: clinician.id,
      hostUserId,
      actorPatientId,
      recipientPatientIds: recipients.map(
        (recipient) => recipient.patientId,
      ),
      startsAt,
      endsAt: finalEndsAt,
    });

    if (conflicts.clinicianConflict) {
      return json(
        {
          ok: false,
          error: 'clinician_conflict',
          appointmentId:
            conflicts.clinicianConflict.id,
        },
        409,
      );
    }

    if (conflicts.patientConflict) {
      return json(
        {
          ok: false,
          error: 'patient_conflict',
          appointmentId:
            conflicts.patientConflict.id,
          startsAt:
            conflicts.patientConflict.startsAt,
          endsAt:
            conflicts.patientConflict.endsAt,
          clinicianId:
            conflicts.patientConflict.clinicianId,
          patientId:
            conflicts.patientConflict.patientId ||
            null,
        },
        409,
      );
    }

    const now = new Date();
    const primaryRecipient = recipients[0];
    const primaryEncounterId = deterministicId(
      'enc',
      appointmentId,
      primaryRecipient.patientId,
    );
    const roomId = deterministicId(
      'room',
      appointmentId,
    );
    const patientParticipantId =
      `pat-${primaryRecipient.patientId}`;
    const clinicianParticipantId =
      `clin-${clinician.id}`;

    const runtimeRecipients = recipients.map(
      (recipient, sequence) => {
        const allocation = quote.allocations[sequence];

        return {
          ...recipient,
          encounterId:
            sequence === 0
              ? primaryEncounterId
              : deterministicId(
                  'enc',
                  appointmentId,
                  recipient.patientId,
                ),
          caseId:
            recipient.caseId ||
            (
              sequence === 0 &&
              requestedCaseId
            ) ||
            deterministicId(
              'case',
              appointmentId,
              recipient.patientId,
            ),
          partyId:
            `pat-${recipient.patientId}`,
          allocation,
        };
      },
    );

    const primaryRuntimeRecipient =
      runtimeRecipients[0];
    const primaryCaseId =
      primaryRuntimeRecipient.caseId;

    const priceCents = quote.totalAmountMinor;
    const platformFeeCents =
      Math.round(priceCents * 0.2);
    const clinicianTakeCents =
      Math.max(0, priceCents - platformFeeCents);

    const fundingDecision = clean(fundingPreview.decision, 80).toUpperCase();
    const sponsorReviewRequired =
      paymentMethod === 'MEDICAL_AID' &&
      fundingPreview.authorizationRequired;
    const patientPayableMinor = Math.max(
      0,
      Number(fundingPreview.patientPayableMinor || 0),
    );
    const sponsorAmountMinor = Math.max(
      0,
      Number(fundingPreview.sponsorAmountMinor || 0),
    );
    const immediatelyConfirmed =
      priceCents <= 0 ||
      (!sponsorReviewRequired && patientPayableMinor <= 0);
    const intentId = bookingIntentId(hostUserId, idempotencyKey);
    const slotKey = bookingSlotKey({
      clinicianId: clinician.id,
      startsAt,
      endsAt: finalEndsAt,
    });
    const holdExpiresAt = immediatelyConfirmed
      ? null
      : computeBookingHoldExpiresAt({
          startsAt,
          now,
        });

    const joinOpensAt = new Date(
      startsAt.getTime() - 15 * 60 * 1000,
    );
    const joinClosesAt = new Date(
      finalEndsAt.getTime() + 60 * 60 * 1000,
    );

    const participantSnapshot = [
      {
        partyId: clinicianParticipantId,
        clinicianId: clinician.id,
        role: 'LEAD_CLINICIAN',
        required: true,
        source: 'appointment',
        name:
          clinician.displayName || 'Clinician',
        specialty:
          clinician.specialty || null,
        access: {
          canJoinTelevisit: true,
          canViewHealth: true,
          canBookAppointments: false,
        },
      },
      ...runtimeRecipients.map(
        (recipient, sequence) => ({
          partyId: recipient.partyId,
          patientId: recipient.patientId,
          careRecipientSequence: sequence,
          role:
            sequence === 0
              ? 'PRIMARY_PATIENT'
              : recipient.role === 'DEPENDANT'
                ? 'DEPENDANT_PATIENT'
                : 'SECOND_PATIENT_PARTICIPANT',
          required: true,
          source: 'appointment_care_recipient',
          name: recipient.displayName,
          status: recipient.identityVerified
            ? 'ACCEPTED'
            : 'PENDING_IDENTITY_VERIFICATION',
          access: {
            canJoinTelevisit: recipient.identityVerified,
            canViewHealth: false,
            canBookAppointments: false,
          },
        }),
      ),
    ];

    const careRecipientSnapshot =
      runtimeRecipients.map((recipient) => ({
        sequence: recipient.sequence,
        patientId: recipient.patientId,
        displayName: recipient.displayName,
        role: recipient.role,
        familyRelationshipId:
          recipient.familyRelationshipId,
        encounterId: recipient.encounterId,
        caseId: recipient.caseId,
        partyId: recipient.partyId,
        identityVerified:
          recipient.identityVerified,
        identityVerificationSource:
          recipient.identityVerificationSource,
        status: recipient.identityVerified
          ? 'READY'
          : 'PENDING_IDENTITY_VERIFICATION',
        allocation: recipient.allocation,
      }));

    const baseMeta = {
      source: 'patient.booking',
      bookingIntegrity: {
        idempotencyKeyHash: sha256Hex(idempotencyKey),
        requestFingerprint,
        priceLockHash: sha256Hex(suppliedPriceLock),
        trustedIdentitySource: who.source,
      },
      bookingReservation: {
        bookingIntentId: intentId,
        slotKey,
        holdExpiresAt: holdExpiresAt?.toISOString() || null,
        ttlMinutes: 20,
        fundingMethod: paymentMethod,
        fundingDecision,
        sponsorAmountMinor,
        patientPayableMinor,
      },
      ticketIssuance: {
        mode: 'ON_DEMAND_VIA_TELEVISIT_ISSUE',
        embeddedJoinTokens: false,
      },
      roomId,
      appointmentId,
      encounterId: primaryEncounterId,
      encounterIds:
        runtimeRecipients.map(
          (recipient) => recipient.encounterId,
        ),
      caseId: primaryCaseId,
      patientParticipantId,
      clinicianParticipantId,
      patientDisplayName:
        clean(
          body.patientName ||
            body.patient_name,
        ) ||
        primaryRecipient.displayName ||
        'Patient',
      patientAvatarUrl:
        primaryRecipient.photoUrl || null,
      patientGender:
        primaryRecipient.gender || null,
      clinicianDisplayName:
        clinician.displayName || 'Clinician',
      clinicianAvatarUrl:
        clinician.photoUrl || null,
      clinicianSpecialty:
        clinician.specialty || null,
      clinicianGender:
        clinician.gender || null,
      clinicianLocation:
        clean(clinician.city) ||
        clean(clinician.practiceName) ||
        clean(clinician.country) ||
        null,
      slotContract: {
        source:
          'server_revalidated_availability',
        status:
          validatedSlot.status || null,
        utcStart: startsAt.toISOString(),
        requestedUtcEnd:
          requestedEndsAt.toISOString(),
        utcEnd: finalEndsAt.toISOString(),
        localStart:
          validatedSlot.localStart || null,
        localEnd:
          validatedSlot.localEnd || null,
        localDate:
          validatedSlot.localDate || null,
        localStartTime:
          validatedSlot.localStartTime || null,
        localEndTime:
          validatedSlot.localEndTime || null,
        localTimeLabel:
          validatedSlot.localTimeLabel || null,
        timezone:
          validatedSlot.timezone ||
          availabilityMeta?.timezone ||
          null,
        baseDurationMin:
          quote.baseDurationMin,
        additionalDurationMin:
          quote.additionalDurationMin,
        durationMin:
          quote.durationMin,
        bufferMin:
          validatedSlot.bufferMin || null,
        baseFeeCents:
          quote.baseAmountMinor,
        feeCents:
          quote.totalAmountMinor,
        currency:
          quote.currency,
        availabilitySource:
          availabilityMeta?.source || null,
        scheduleMatchedUserId:
          availabilityMeta?.schedule
            ?.matchedUserId || null,
      },
      multiCare: {
        enabled: quote.multiCare,
        recipientCount:
          quote.recipientCount,
        policy: quote.policy,
        allocations:
          quote.allocations,
        recipients:
          careRecipientSnapshot,
      },
      participants: participantSnapshot,
    };

    const created = await prisma.$transaction(
      async (tx: any) => {
        await lockClinicianBookingLane(tx, clinician.id);

        const transactionConflicts =
          await findMultiCareConflicts({
            db: tx,
            clinicianId: clinician.id,
            hostUserId,
            actorPatientId,
            recipientPatientIds:
              recipients.map(
                (recipient) =>
                  recipient.patientId,
              ),
            startsAt,
            endsAt: finalEndsAt,
          });

        if (
          transactionConflicts.clinicianConflict
        ) {
          throw new MultiCareBookingError(
            'clinician_conflict',
            409,
          );
        }

        if (
          transactionConflicts.patientConflict
        ) {
          throw new MultiCareBookingError(
            'patient_conflict',
            409,
          );
        }

        const transactionFunding = await previewBookingFunding({
          method: paymentMethod,
          patientId: recipients[0].patientId,
          clinicianUserId: clean(clinician.userId || clinician.id),
          clinicianId: clinician.id,
          hostUserId,
          kind: appointmentKind,
          totalAmountMinor: quote.totalAmountMinor,
          currency: quote.currency,
          orgId,
          clientId: clean(body.clientId || body.client_id) || undefined,
          voucherCode: clean(body.voucherCode || body.voucher_code, 160) || undefined,
          db: tx,
        });

        if (!transactionFunding.canProceed) {
          throw new MultiCareBookingError(
            'funding_preflight_changed',
            409,
            {
              decision: transactionFunding.decision,
              reason: transactionFunding.reason,
            },
          );
        }

        const txSponsorReviewRequired =
          paymentMethod === 'MEDICAL_AID' &&
          transactionFunding.authorizationRequired;
        const txPatientPayableMinor = Math.max(
          0,
          Number(transactionFunding.patientPayableMinor || 0),
        );
        const txSponsorAmountMinor = Math.max(
          0,
          Number(transactionFunding.sponsorAmountMinor || 0),
        );
        const txImmediatelyConfirmed =
          priceCents <= 0 ||
          (!txSponsorReviewRequired && txPatientPayableMinor <= 0);
        const txPaymentStatus =
          priceCents <= 0
            ? 'NOT_REQUIRED'
            : txImmediatelyConfirmed
              ? 'AUTHORIZED'
              : 'PENDING';
        const txAppointmentStatus = txImmediatelyConfirmed
          ? 'confirmed'
          : 'pending_payment';
        const txIntentStatus = txImmediatelyConfirmed
          ? 'CONFIRMED'
          : txSponsorReviewRequired
            ? 'SPONSOR_REVIEW'
            : paymentMethod === 'CARD'
              ? 'PAYMENT_ACTION_REQUIRED'
              : 'COPAY_REQUIRED';
        const txHoldExpiresAt = txImmediatelyConfirmed
          ? null
          : computeBookingHoldExpiresAt({ startsAt, now });

        const existingIntent = await tx.bookingIntent.findFirst({
          where: {
            hostUserId,
            idempotencyKeyHash: reservationSha256Hex(idempotencyKey),
          },
        });
        if (existingIntent) {
          throw new MultiCareBookingError(
            'booking_intent_already_exists_without_replayable_appointment',
            409,
          );
        }

        const intent = await tx.bookingIntent.create({
          data: {
            id: intentId,
            requestFingerprint,
            idempotencyKeyHash: reservationSha256Hex(idempotencyKey),
            hostUserId,
            actorPatientId,
            clinicianId: clinician.id,
            status: txIntentStatus,
            fundingMethod: paymentMethod,
            kind: appointmentKind,
            visitMode: 'TELEVISIT',
            startsAt,
            endsAt: finalEndsAt,
            slotKey,
            slotOfferHash: reservationSha256Hex(
              `${clinician.id}\u0000${startsAt.toISOString()}\u0000${requestedEndsAt.toISOString()}`,
            ),
            slotOfferExpiresAt: startsAt,
            priceLockHash: reservationSha256Hex(suppliedPriceLock),
            priceLockExpiresAt: new Date(lockPayload.expiresAt),
            holdExpiresAt: txHoldExpiresAt,
            amountMinor: priceCents,
            subtotalMinor: priceCents,
            taxMinor: 0,
            discountMinor: 0,
            totalMinor: priceCents,
            sponsorAmountMinor: txSponsorAmountMinor,
            patientPayableMinor: txPatientPayableMinor,
            currency: quote.currency,
            coverageDecision: transactionFunding.decision,
            reason:
              clean(body.reason || body.title || body.notes) ||
              'Televisit consultation',
            caseId: primaryCaseId,
            confirmedAt: txImmediatelyConfirmed ? now : null,
            quoteSnapshot: {
              totalAmountMinor: quote.totalAmountMinor,
              durationMin: quote.durationMin,
              currency: quote.currency,
              policy: quote.policy,
              allocations: quote.allocations,
            },
            coverageSnapshot: transactionFunding,
            recipientSnapshot: careRecipientSnapshot,
            metadata: {
              source: 'patient.booking',
              clinicianDisplayName: clinician.displayName || 'Clinician',
              selectedFundingMethod: paymentMethod,
            },
            orgId,
          } as any,
        });

        await tx.bookingSlotLease.create({
          data: {
            bookingIntentId: intent.id,
            slotKey,
            clinicianId: clinician.id,
            startsAt,
            endsAt: finalEndsAt,
            status: txImmediatelyConfirmed ? 'CONSUMED' : 'ACTIVE',
            holdTokenHash: reservationSha256Hex(
              `${intent.id}\u0000${idempotencyKey}\u0000${slotKey}`,
            ),
            expiresAt: txHoldExpiresAt || finalEndsAt,
            consumedAt: txImmediatelyConfirmed ? now : null,
            metadata: {
              source: 'canonical_patient_booking',
              ttlMinutes: 20,
            },
            orgId,
          } as any,
        });

        let coverageAuthorizationId: string | null = null;

        if (txSponsorReviewRequired) {
          if (
            !transactionFunding.clientId ||
            !transactionFunding.clientMemberId ||
            !transactionFunding.coveragePlanId
          ) {
            throw new MultiCareBookingError(
              'coverage_authorization_context_missing',
              409,
            );
          }

          const authorization = await createCoverageAuthorization({
            orgId,
            clientId: transactionFunding.clientId,
            coveragePlanId: transactionFunding.coveragePlanId,
            clientMemberId: transactionFunding.clientMemberId,
            userId: hostUserId,
            patientId: primaryRecipient.patientId,
            scopeType: 'APPOINTMENT',
            scopeId: appointmentId,
            serviceType:
              appointmentKind === 'FOLLOWUP'
                ? 'CONSULT_FOLLOWUP'
                : 'CONSULT_STANDARD',
            requestedAmountMinor: priceCents,
            currency: quote.currency,
            ruleSnapshot: {
              ...(transactionFunding.ruleSnapshot || {}),
              bookingIntentId: intent.id,
              preflightDecision: transactionFunding.decision,
              sponsorAmountMinor: txSponsorAmountMinor,
              patientPayableMinor: txPatientPayableMinor,
            },
            metadata: {
              source: 'patient.booking',
              bookingIntentId: intent.id,
              appointmentId,
              clinicianId: clinician.id,
              visitMode: 'TELEVISIT',
            },
            tx,
            idempotencyKey: `booking:${intent.id}:coverage`,
          });

          coverageAuthorizationId = authorization.id;
          await tx.coverageAuthorization.update({
            where: { id: authorization.id },
            data: {
              appointmentId,
              clinicianId: clinician.id,
              visitMode: 'TELEVISIT',
            },
          });
          await tx.bookingIntent.update({
            where: { id: intent.id },
            data: { coverageAuthorizationId },
          });
        }

        if (paymentMethod === 'VOUCHER') {
          if (!transactionFunding.voucherId) {
            throw new MultiCareBookingError('voucher_authority_missing', 409);
          }

          const voucher = await tx.voucherCode.findUnique({
            where: { id: transactionFunding.voucherId },
          });
          if (!voucher || !voucher.active) {
            throw new MultiCareBookingError('voucher_no_longer_available', 409);
          }

          const nextUsedCount = voucher.usedCount + 1;
          const mutation = await tx.voucherCode.updateMany({
            where: {
              id: voucher.id,
              active: true,
              usedCount: voucher.usedCount,
            },
            data: {
              usedCount: nextUsedCount,
              active:
                voucher.maxUses === 0 || nextUsedCount < voucher.maxUses,
            },
          });
          if (mutation.count !== 1) {
            throw new MultiCareBookingError('voucher_concurrent_redemption', 409);
          }

          await tx.voucherRedemption.create({
            data: {
              voucherId: voucher.id,
              userId: hostUserId,
              creditedZar: Math.floor(txSponsorAmountMinor / 100),
              meta: {
                source: 'canonical_patient_booking',
                bookingIntentId: intent.id,
                appointmentId,
                amountMinor: txSponsorAmountMinor,
                currency: quote.currency,
                provisional: !txImmediatelyConfirmed,
                voucherUsedCountBefore: voucher.usedCount,
                voucherAutoDeactivated:
                  voucher.maxUses > 0 && nextUsedCount >= voucher.maxUses,
              },
              orgId,
            },
          });
        }

        for (const recipient of runtimeRecipients) {
          const allocation = recipient.allocation;
          await tx.bookingIntentRecipient.create({
            data: {
              bookingIntentId: intent.id,
              patientId: recipient.patientId,
              patientUserId: recipient.patientUserId,
              hostUserId,
              familyRelationshipId: recipient.familyRelationshipId,
              role: recipient.sequence === 0 ? 'PRIMARY' : recipient.role,
              sequence: recipient.sequence,
              status: recipient.identityVerified
                ? paymentMethod === 'MEDICAL_AID'
                  ? txSponsorReviewRequired
                    ? 'PENDING_COVERAGE'
                    : txPatientPayableMinor > 0
                      ? 'COPAY_REQUIRED'
                      : 'COVERED'
                  : 'READY'
                : 'PENDING_IDENTITY_VERIFICATION',
              identityVerifiedAt: recipient.identityVerified ? now : null,
              reason: recipient.reason || null,
              caseId: recipient.caseId,
              baseAmountMinor: allocation.baseAmountMinor,
              additionalAmountMinor: allocation.additionalAmountMinor,
              discountMinor: allocation.discountMinor,
              grossAmountMinor: allocation.grossAmountMinor,
              sponsorAmountMinor:
                recipient.sequence === 0 ? txSponsorAmountMinor : 0,
              patientPayableMinor:
                recipient.sequence === 0
                  ? txPatientPayableMinor
                  : allocation.patientPayableMinor,
              currency: allocation.currency,
              coverageDecision: transactionFunding.decision,
              coverageAuthorizationId:
                recipient.sequence === 0 ? coverageAuthorizationId : null,
              pricingSnapshot: {
                policyId: quote.policy?.id || null,
                policyVersion: quote.policy?.version || null,
                allocation,
              },
              coverageSnapshot: transactionFunding,
              metadata: {
                displayName: recipient.displayName,
                partyId: recipient.partyId,
              },
              orgId,
            } as any,
          });
        }

        const encounterRows: any[] = [];

        for (
          const recipient of runtimeRecipients
        ) {
          const encounter =
            await tx.encounter.create({
              data: {
                id: recipient.encounterId,
                caseId: recipient.caseId,
                patientId:
                  recipient.patientId,
                clinicianId:
                  clinician.id,
                sessionId: null,
                visitMode: 'TELEVISIT',
                status: 'scheduled',
                orgId,
              } as any,
            });

          encounterRows.push(encounter);
        }

        const appointment =
          await tx.appointment.create({
            data: {
              id: appointmentId,
              encounterId:
                primaryEncounterId,
              sessionId: null,
              caseId: primaryCaseId,
              clinicianId: clinician.id,
              patientId:
                primaryRecipient.patientId,
              hostUserId,
              subjectPatientId:
                primaryRecipient.patientId,
              familyRelationshipId:
                primaryRecipient
                  .familyRelationshipId,
              roomId,
              reason:
                clean(
                  body.reason ||
                    body.title ||
                    body.notes,
                ) ||
                'Televisit consultation',
              kind: appointmentKind,
              visitMode: 'TELEVISIT',
              startsAt,
              endsAt: finalEndsAt,
              status: txAppointmentStatus,
              confirmedAt:
                txAppointmentStatus === 'confirmed'
                  ? now
                  : null,
              paymentMethod:
                paymentMethod as any,
              paymentStatus:
                txPaymentStatus as any,
              paymentProvider: null,
              paymentRef: null,
              priceCents,
              currency: quote.currency,
              platformFeeCents,
              clinicianTakeCents,
              amountMinor: priceCents,
              subtotalMinor: priceCents,
              taxMinor: 0,
              discountMinor: 0,
              totalMinor: priceCents,
              patientCopayMinor:
                txPatientPayableMinor,
              sponsorAmountMinor: txSponsorAmountMinor,
              sponsorCurrency:
                quote.currency,
              coverageDecision:
                transactionFunding.decision,
              bookingSource:
                'patient_app',
              meta: baseMeta,
              orgId,
            } as any,
          });

        await tx.bookingIntent.update({
          where: { id: intent.id },
          data: {
            appointmentId: appointment.id,
          },
        });

        const session =
          await tx.consultationSession.create({
            data: {
              appointmentId:
                appointment.id,
              encounterId:
                primaryEncounterId,
              caseId: primaryCaseId,
              clinicianId: clinician.id,
              patientId:
                primaryRecipient.patientId,
              hostUserId,
              visitMode: 'TELEVISIT',
              roomId,
              state: 'READY',
              currency: quote.currency,
              amountAuthorizedMinor:
                priceCents,
              metadata: baseMeta,
            } as any,
          });

        const visit =
          await tx.televisit.create({
            data: {
              appointmentId:
                appointment.id,
              encounterId:
                primaryEncounterId,
              roomId,
              scheduledStartAt:
                startsAt,
              scheduledEndAt:
                finalEndsAt,
              joinOpensAt,
              joinClosesAt,
              status: 'planned',
              orgId,
            } as any,
          });

        const careRecipientRows: any[] = [];

        for (
          const recipient of runtimeRecipients
        ) {
          const allocation =
            recipient.allocation;

          const row =
            await tx.appointmentCareRecipient.create({
              data: {
                appointmentId:
                  appointment.id,
                patientId:
                  recipient.patientId,
                encounterId:
                  recipient.encounterId,
                pricingPolicyId:
                  quote.policy?.id || null,
                role:
                  recipient.sequence === 0
                    ? 'PRIMARY'
                    : recipient.role,
                sequence:
                  recipient.sequence,
                hostUserId,
                familyRelationshipId:
                  recipient
                    .familyRelationshipId,
                required: true,
                status: recipient.identityVerified
                  ? 'READY'
                  : 'PENDING_IDENTITY_VERIFICATION',
                identityVerifiedAt:
                  recipient.identityVerified
                    ? now
                    : null,
                identityVerifiedByUserId:
                  recipient.identityVerified
                    ? hostUserId
                    : null,
                reason:
                  recipient.reason ||
                  clean(
                    body.reason ||
                      body.title ||
                      body.notes,
                  ) ||
                  null,
                baseAmountMinor:
                  allocation
                    .baseAmountMinor,
                additionalAmountMinor:
                  allocation
                    .additionalAmountMinor,
                discountMinor:
                  allocation
                    .discountMinor,
                grossAmountMinor:
                  allocation
                    .grossAmountMinor,
                sponsorAmountMinor:
                  recipient.sequence === 0
                    ? txSponsorAmountMinor
                    : 0,
                patientPayableMinor:
                  recipient.sequence === 0
                    ? txPatientPayableMinor
                    : allocation.patientPayableMinor,
                currency:
                  allocation.currency,
                coverageDecision:
                  transactionFunding.decision,
                coverageAuthorizationId:
                  recipient.sequence === 0
                    ? coverageAuthorizationId
                    : null,
                pricingSnapshot: {
                  policyId:
                    quote.policy?.id || null,
                  policyVersion:
                    quote.policy?.version ||
                    null,
                  pricingMode:
                    quote.policy
                      ?.pricingMode ||
                    'SINGLE_RECIPIENT',
                  allocation,
                },
                coverageSnapshot: {
                  paymentMethod,
                  state: txIntentStatus,
                  decision: transactionFunding.decision,
                  authorizationRequired:
                    transactionFunding.authorizationRequired,
                  sponsorAmountMinor: txSponsorAmountMinor,
                  patientPayableMinor: txPatientPayableMinor,
                },
                metadata: {
                  displayName:
                    recipient.displayName,
                  partyId:
                    recipient.partyId,
                  caseId:
                    recipient.caseId,
                  identityVerificationSource:
                    recipient
                      .identityVerificationSource,
                },
                orgId,
              } as any,
            });

          careRecipientRows.push(row);
        }

        const careRecipientByPatient =
          new Map(
            careRecipientRows.map(
              (row: any) => [
                String(row.patientId),
                row,
              ],
            ),
          );

        await tx.appointmentParticipant.create({
          data: {
            appointmentId:
              appointment.id,
            careRecipientId: null,
            partyId:
              clinicianParticipantId,
            role: 'LEAD_CLINICIAN',
            clinicianId:
              clinician.id,
            userId:
              clinician.userId || null,
            displayName:
              clinician.displayName ||
              'Clinician',
            required: true,
            status: 'ACCEPTED',
            consentRequired: false,
            canJoinTelevisit: true,
            canViewHealth: true,
            canBookAppointments: false,
            acceptedAt: now,
            metadata: {
              source:
                'appointment_creation',
              specialty:
                clinician.specialty ||
                null,
            },
            orgId,
          } as any,
        });

        const participantRows: any[] = [];

        for (
          const recipient of runtimeRecipients
        ) {
          const careRecipient =
            careRecipientByPatient.get(
              recipient.patientId,
            );

          const participant =
            await tx.appointmentParticipant.create({
              data: {
                appointmentId:
                  appointment.id,
                careRecipientId:
                  careRecipient?.id || null,
                partyId:
                  recipient.partyId,
                role:
                  recipient.sequence === 0
                    ? 'PRIMARY_PATIENT'
                    : recipient.role ===
                        'DEPENDANT'
                      ? 'DEPENDANT_PATIENT'
                      : 'SECOND_PATIENT_PARTICIPANT',
                patientId:
                  recipient.patientId,
                userId:
                  recipient.patientUserId,
                hostUserId,
                familyRelationshipId:
                  recipient
                    .familyRelationshipId,
                displayName:
                  recipient.displayName,
                required: true,
                status: recipient.identityVerified
                  ? 'ACCEPTED'
                  : 'PENDING_ACCEPTANCE',
                consentRequired: true,
                canJoinTelevisit:
                  recipient.identityVerified,
                canViewHealth: false,
                canBookAppointments:
                  false,
                acceptedAt:
                  recipient.identityVerified
                    ? now
                    : null,
                metadata: {
                  source:
                    'appointment_care_recipient',
                  sequence:
                    recipient.sequence,
                  encounterId:
                    recipient.encounterId,
                  caseId:
                    recipient.caseId,
                },
                orgId,
              } as any,
            });

          participantRows.push(
            participant,
          );
        }

        await tx.appointmentAuditEvent
          .create({
            data: {
              appointmentId:
                appointment.id,
              action:
                quote.multiCare
                  ? 'multi_care_booking_created'
                  : 'patient_booking_created',
              actorType:
                who.role || 'patient',
              actorUserId:
                who.uid ||
                actorPatientId,
              reason:
                clean(
                  body.reason ||
                    body.title ||
                    body.notes,
                ) || null,
              afterJson: {
                appointmentId:
                  appointment.id,
                encounterIds:
                  encounterRows.map(
                    (row) => row.id,
                  ),
                consultationSessionId:
                  session.id,
                televisitId:
                  visit.id,
                roomId,
                clinicianId:
                  clinician.id,
                hostUserId,
                careRecipients:
                  careRecipientSnapshot,
                startsAt:
                  startsAt.toISOString(),
                endsAt:
                  finalEndsAt.toISOString(),
                paymentStatus: txPaymentStatus,
                bookingIntentId: intent.id,
                bookingIntentStatus: txIntentStatus,
                holdExpiresAt: txHoldExpiresAt?.toISOString() || null,
                totalAmountMinor:
                  priceCents,
              },
              orgId,
            },
          })
          .catch(() => null);

        await tx.clinicianProfile
          .update({
            where: {
              id: clinician.id,
            },
            data: {
              lastBookedAt: now,
              recentBookedCount: {
                increment: 1,
              },
            } as any,
          })
          .catch(() => null);

        return {
          encounter:
            encounterRows[0],
          encounters:
            encounterRows,
          appointment,
          session,
          visit,
          careRecipients:
            careRecipientRows,
          participants:
            participantRows,
          bookingIntentId: intent.id,
          bookingIntentStatus: txIntentStatus,
          holdExpiresAt: txHoldExpiresAt,
          funding: transactionFunding,
          coverageAuthorizationId,
        };
      },
    );

    const clinicianOrigin = appOrigin(
      req,
      [
        'CLINICIAN_APP_ORIGIN',
        'NEXT_PUBLIC_CLINICIAN_APP_ORIGIN',
      ],
      'https://clinician.ambulantplus.co.za',
    );
    const patientOrigin = appOrigin(
      req,
      [
        'PATIENT_APP_ORIGIN',
        'NEXT_PUBLIC_PATIENT_APP_ORIGIN',
      ],
      'https://patient.ambulantplus.co.za',
    );
    const sharedParams = {
      visitId: created.visit.id,
      appointmentId: created.appointment.id,
      encounterId: created.encounter.id,
      clinicianId: clinician.id,
      patientId: primaryRecipient.patientId,
      reason: created.appointment.reason || '',
      patientName: baseMeta.patientDisplayName,
      clinicianName: baseMeta.clinicianDisplayName,
    };
    const clinicianJoinUrl = buildJoinUrl(
      clinicianOrigin,
      roomId,
      {
        ...sharedParams,
        participantId: clinicianParticipantId,
      },
    );
    const patientJoinUrl = buildJoinUrl(
      patientOrigin,
      roomId,
      {
        ...sharedParams,
        participantId: patientParticipantId,
      },
    );

    await prisma.appointment
      .update({
        where: { id: created.appointment.id },
        data: {
          meta: {
            ...baseMeta,
            visitId: created.visit.id,
            televisitId: created.visit.id,
            clinicianJoinUrl,
            patientJoinUrl,
            ticketIssuance: {
              mode: 'ON_DEMAND_VIA_TELEVISIT_ISSUE',
              embeddedJoinTokens: false,
            },
            additionalRecipientAdmission:
              quote.multiCare
                ? 'PERSISTED_PARTICIPANTS_PENDING_SWEEP_3_ADMISSION'
                : 'ON_DEMAND_VIA_TELEVISIT_ISSUE',
          },
        } as any,
      })
      .catch(() => null);

    const booking =
      await bookingStateForAppointment(created.appointment.id);

    const appointment = {
      ...created.appointment,
      startsAt:
        created.appointment.startsAt.toISOString(),
      endsAt:
        created.appointment.endsAt.toISOString(),
      createdAt:
        created.appointment.createdAt.toISOString(),
      updatedAt:
        created.appointment.updatedAt.toISOString(),
      visitId: created.visit.id,
      televisitId: created.visit.id,
      roomId,
      clinicianJoinUrl,
      patientJoinUrl,
      clinicianParticipantId,
      patientParticipantId,
      patientName:
        baseMeta.patientDisplayName,
      patientDisplayName:
        baseMeta.patientDisplayName,
      patientAvatarUrl:
        baseMeta.patientAvatarUrl,
      clinicianName:
        baseMeta.clinicianDisplayName,
      clinicianDisplayName:
        baseMeta.clinicianDisplayName,
      clinicianAvatarUrl:
        baseMeta.clinicianAvatarUrl,
      clinicianSpecialty:
        baseMeta.clinicianSpecialty,
      clinicianLocation:
        baseMeta.clinicianLocation,
      multiCare:
        baseMeta.multiCare,
      booking,
    };

    return json(
      {
        ok: true,
        appointment,
        appointmentId:
          created.appointment.id,
        appointment_id:
          created.appointment.id,
        encounterId:
          created.encounter.id,
        encounter_id:
          created.encounter.id,
        encounterIds:
          created.encounters.map(
            (encounter: any) =>
              encounter.id,
          ),
        consultationSessionId:
          created.session.id,
        visitId:
          created.visit.id,
        televisitId:
          created.visit.id,
        roomId,
        clinicianJoinUrl,
        patientJoinUrl,
        paymentStatus:
          created.appointment.paymentStatus,
        status:
          created.appointment.status,
        funding: created.funding,
        booking,
        coverageAuthorizationId:
          created.coverageAuthorizationId,
        multiCare: {
          ...baseMeta.multiCare,
          careRecipientIds:
            created.careRecipients.map(
              (recipient: any) =>
                recipient.id,
            ),
        },
      },
      201,
    );
  } catch (error: any) {
    console.error(
      '[api-gateway][appointments.POST] error',
      error,
    );

    if (
      error instanceof MultiCareBookingError
    ) {
      return json(
        {
          ok: false,
          error: error.code,
          details: error.details,
        },
        error.status,
      );
    }

    const message = String(
      error?.message ||
        'appointment_create_failed',
    );
    const lowerMessage = message.toLowerCase();
    const status =
      lowerMessage.includes('unique constraint')
        ? 409
        : lowerMessage.includes('clinician_conflict')
          ? 409
          : lowerMessage.includes('patient_conflict')
            ? 409
            : lowerMessage.includes('untrusted') ||
                lowerMessage.includes('unauthorized')
              ? 401
              : 500;

    return json(
      {
        ok: false,
        error: message,
      },
      status,
    );
  }
}
