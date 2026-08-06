// apps/api-gateway/app/api/appointments/preflight/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  MultiCareBookingError,
  createMultiCarePriceLock,
  findMultiCareConflicts,
  resolveAuthorizedCareRecipients,
  resolveMultiCareQuote,
} from '@/src/appointments/multi-care';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
      'cache-control': 'no-store',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function dateFrom(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date : null;
}

function amountMinor(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue));
}

function minutesBetween(startsAt: Date, endsAt: Date) {
  return Math.max(
    5,
    Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
  );
}

function addUtcDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number);
  const value = new Date(
    Date.UTC(year, (month || 1) - 1, day || 1),
  );
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function sameInstant(value: unknown, expected: Date) {
  const milliseconds = Date.parse(String(value || ''));
  return (
    Number.isFinite(milliseconds) &&
    milliseconds === expected.getTime()
  );
}

function bookableSlotStatus(value: unknown) {
  const status = clean(value, 40).toLowerCase();
  return status === 'available' || status === 'limited';
}

function pickConsultType(value: unknown) {
  const kind = clean(value, 40).toLowerCase();
  return kind === 'followup' || kind === 'follow-up'
    ? 'followup'
    : 'standard';
}

async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function revalidateSelectedAvailabilitySlot(args: {
  req: NextRequest;
  clinicianId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  caseId: string | null;
}) {
  const from = addUtcDaysYmd(
    args.startsAt.toISOString().slice(0, 10),
    -1,
  );
  const type = pickConsultType(args.kind);
  const url = new URL(
    `/api/clinicians/${encodeURIComponent(args.clinicianId)}/availability`,
    args.req.url,
  );

  url.searchParams.set('from', from);
  url.searchParams.set('days', '3');
  url.searchParams.set('includeUnavailable', '1');
  url.searchParams.set('type', type);
  if (args.caseId) url.searchParams.set('caseId', args.caseId);

  const headers = new Headers();
  for (const key of [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-request-id',
    'x-correlation-id',
  ]) {
    const value = args.req.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('accept', 'application/json');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data: any = await readJsonSafe(response);

  if (!response.ok || !data || data.ok === false) {
    throw new MultiCareBookingError(
      data?.error || 'availability_revalidation_failed',
      response.status || 502,
      data,
    );
  }

  const slots = Array.isArray(data.slots) ? data.slots : [];
  const slot = slots.find(
    (candidate: any) =>
      sameInstant(candidate?.start, args.startsAt) &&
      sameInstant(candidate?.end, args.endsAt),
  );

  if (!slot) {
    throw new MultiCareBookingError(
      'selected_slot_not_in_current_availability',
      409,
      {
        startsAt: args.startsAt.toISOString(),
        endsAt: args.endsAt.toISOString(),
        consultType: type,
      },
    );
  }

  if (!bookableSlotStatus(slot.status)) {
    throw new MultiCareBookingError(
      'selected_slot_not_bookable',
      409,
      { slot },
    );
  }

  return slot;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
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

    const body = await req.json().catch(() => ({} as any));

    const clinicianRef = clean(body.clinicianId || body.clinician_id);
    const startsAt = dateFrom(
      body.startsAt ||
        body.starts_at ||
        body.start ||
        body.startTime,
    );
    const requestedEndsAt = dateFrom(
      body.endsAt ||
        body.ends_at ||
        body.end ||
        body.endTime,
    );

    const actorPatientId = clean(who.actorRefId);
    const hostUserId = clean(who.uid);
    const fallbackSubjectPatientId = clean(
      body.subjectPatientId ||
        body.subject_patient_id ||
        body.person?.subjectPatientId ||
        actorPatientId,
    );

    if (!clinicianRef || !startsAt || !requestedEndsAt) {
      return json(
        {
          ok: false,
          error: 'clinicianId_startsAt_endsAt_required',
        },
        400,
      );
    }

    if (!actorPatientId || !hostUserId) {
      return json(
        { ok: false, error: 'patient_identity_required' },
        401,
      );
    }

    if (requestedEndsAt <= startsAt) {
      return json(
        { ok: false, error: 'invalid_time_range' },
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
      String(clinician.status || '').toLowerCase() !== 'active'
    ) {
      return json(
        { ok: false, error: 'clinician_not_bookable' },
        409,
      );
    }

    const feeKind =
      clean(body.kind).toUpperCase() === 'FOLLOWUP'
        ? 'FOLLOWUP'
        : 'STANDARD';
    const requestedCaseId = clean(body.caseId || body.case_id) || null;
    const validatedSlot = await revalidateSelectedAvailabilitySlot({
      req,
      clinicianId: clinician.id,
      startsAt,
      endsAt: requestedEndsAt,
      kind: feeKind,
      caseId: requestedCaseId,
    });

    const recipients = await resolveAuthorizedCareRecipients({
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
      fallbackCaseId: requestedCaseId,
    });

    if (
      feeKind === 'FOLLOWUP' &&
      recipients.some((recipient) => !recipient.caseId)
    ) {
      throw new MultiCareBookingError(
        'followup_case_required_for_each_care_recipient',
        400,
      );
    }

    const baseAmountMinor = amountMinor(
      validatedSlot.feeCents,
      Number(clinician.feeCents || 0),
    );
    const currency = clean(
      validatedSlot.currency ||
        clinician.currency ||
        'ZAR',
      3,
    ).toUpperCase();
    const baseDurationMin = Math.max(
      5,
      Number(validatedSlot.durationMin) ||
        minutesBetween(startsAt, requestedEndsAt),
    );

    const quote = await resolveMultiCareQuote({
      clinicianUserId: clean(clinician.userId || clinician.id),
      recipients,
      feeKind,
      visitMode: 'televisit',
      baseAmountMinor,
      currency,
      baseDurationMin,
    });

    const finalEndsAt = new Date(
      startsAt.getTime() + quote.durationMin * 60_000,
    );

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

    const conflictDetails: any[] = [];

    if (conflicts.clinicianConflict) {
      conflictDetails.push({
        code: 'clinician_conflict',
        appointmentId: conflicts.clinicianConflict.id,
        startsAt: conflicts.clinicianConflict.startsAt,
        endsAt: conflicts.clinicianConflict.endsAt,
      });
    }

    if (conflicts.patientConflict) {
      conflictDetails.push({
        code: 'patient_conflict',
        appointmentId: conflicts.patientConflict.id,
        patientId: conflicts.patientConflict.patientId || null,
        startsAt: conflicts.patientConflict.startsAt,
        endsAt: conflicts.patientConflict.endsAt,
        clinicianId: conflicts.patientConflict.clinicianId,
      });
    }

    if (conflictDetails.length > 0) {
      return json(
        {
          ok: false,
          canProceed: false,
          error: conflictDetails[0].code,
          conflicts: {
            hasConflict: true,
            details: conflictDetails,
          },
        },
        409,
      );
    }

    const lock = createMultiCarePriceLock({
      clinicianId: clinician.id,
      hostUserId,
      actorPatientId,
      startsAt: startsAt.toISOString(),
      requestedEndsAt: requestedEndsAt.toISOString(),
      finalEndsAt: finalEndsAt.toISOString(),
      feeKind,
      visitMode: 'televisit',
      recipientIds: recipients.map(
        (recipient) => recipient.patientId,
      ),
      totalAmountMinor: quote.totalAmountMinor,
      currency: quote.currency,
      durationMin: quote.durationMin,
      policyId: quote.policy?.id || null,
      policyVersion: quote.policy?.version ?? null,
    });

    const warnings = quote.multiCare
      ? [
          {
            code: 'multi_care_booking',
            severity: 'info',
            title: 'Multi-care consultation',
            message:
              `${quote.recipientCount} care recipients will share one appointment ` +
              `with separate clinical encounters.`,
            requiresAck: false,
          },
        ]
      : [];

    return json({
      ok: true,
      canProceed: true,
      decisionToken: lock.token,
      expiresAt: lock.payload.expiresAt,
      warnings,
      conflicts: {
        hasConflict: false,
        details: [],
      },
      priceLock: {
        token: lock.token,
        amountMinor: quote.totalAmountMinor,
        patientPayableMinor: quote.totalAmountMinor,
        currency: quote.currency,
        expiresAt: lock.payload.expiresAt,
      },
      multiCare: {
        enabled: quote.multiCare,
        recipientCount: quote.recipientCount,
        recipients: recipients.map((recipient) => ({
          sequence: recipient.sequence,
          patientId: recipient.patientId,
          displayName: recipient.displayName,
          role: recipient.role,
          familyRelationshipId:
            recipient.familyRelationshipId,
          identityVerified: recipient.identityVerified,
          caseId: recipient.caseId,
        })),
        policy: quote.policy,
        allocations: quote.allocations,
        baseDurationMin: quote.baseDurationMin,
        additionalDurationMin:
          quote.additionalDurationMin,
        durationMin: quote.durationMin,
        startsAt: startsAt.toISOString(),
        requestedEndsAt:
          requestedEndsAt.toISOString(),
        endsAt: finalEndsAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[appointments.preflight] error', error);

    if (error instanceof MultiCareBookingError) {
      return json(
        {
          ok: false,
          canProceed: false,
          error: error.code,
          details: error.details,
        },
        error.status,
      );
    }

    const message = String(
      error?.message || 'appointment_preflight_failed',
    );
    const lowerMessage = message.toLowerCase();
    const status =
      lowerMessage.includes('untrusted') ||
      lowerMessage.includes('unauthorized')
        ? 401
        : 500;

    return json(
      {
        ok: false,
        canProceed: false,
        error: message,
      },
      status,
    );
  }
}
