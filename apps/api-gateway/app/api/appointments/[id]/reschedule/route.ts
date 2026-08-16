// apps/api-gateway/app/api/appointments/[id]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  findMultiCareConflicts,
} from '@/src/appointments/multi-care';
import {
  AvailabilityError,
  validateAvailabilityInterval,
} from '@/src/availability/resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INACTIVE_STATUSES = ['canceled', 'cancelled', 'completed'];

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function parseDate(value: unknown) {
  const text = clean(value, 120);
  if (!text) return null;

  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

function readMeta(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 60_000),
  );
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function activeStatus(value: unknown) {
  return !INACTIVE_STATUSES.includes(
    clean(value, 80).toLowerCase(),
  );
}

async function resolveAuthorizedActor(req: NextRequest, appointment: any) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);
  } catch {
    return {
      error: json({ ok: false, error: 'unauthorized' }, 401),
      role: '',
    };
  }

  const role = clean(who.role, 80).toLowerCase();

  if (role === 'patient') {
    const uid = clean(who.uid);
    const actorPatientId = clean(who.actorRefId);

    if (!uid || !actorPatientId) {
      return {
        error: json(
          { ok: false, error: 'patient_identity_required' },
          401,
        ),
        role,
      };
    }

    const ownsAppointment =
      clean(appointment.hostUserId) === uid ||
      clean(appointment.patientId) === actorPatientId ||
      clean(appointment.subjectPatientId) === actorPatientId;

    if (!ownsAppointment) {
      return {
        error: json(
          { ok: false, error: 'appointment_access_denied' },
          403,
        ),
        role,
      };
    }

    return { error: null, role };
  }

  if (role === 'clinician') {
    const refs = Array.from(
      new Set(
        [who.uid, who.actorRefId]
          .map((value) => clean(value))
          .filter(Boolean),
      ),
    );

    if (!refs.length) {
      return {
        error: json(
          { ok: false, error: 'clinician_identity_required' },
          401,
        ),
        role,
      };
    }

    const clinician = await (prisma as any).clinicianProfile.findFirst({
      where: {
        OR: refs.flatMap((ref) => [
          { id: ref },
          { userId: ref },
        ]),
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (
      !clinician ||
      clean(clinician.id) !== clean(appointment.clinicianId)
    ) {
      return {
        error: json(
          { ok: false, error: 'appointment_access_denied' },
          403,
        ),
        role,
      };
    }

    return { error: null, role };
  }

  return {
    error: json(
      { ok: false, error: 'reschedule_role_not_allowed' },
      403,
    ),
    role,
  };
}

async function loadRecipientPatientIds(db: any, appointment: any) {
  const ids = new Set<string>();

  for (const value of [
    appointment?.patientId,
    appointment?.subjectPatientId,
  ]) {
    const id = clean(value);
    if (id) ids.add(id);
  }

  if (db.appointmentCareRecipient?.findMany) {
    const rows = await db.appointmentCareRecipient.findMany({
      where: {
        appointmentId: appointment.id,
        status: {
          notIn: ['DECLINED', 'REMOVED', 'CANCELLED'],
        },
      },
      select: { patientId: true },
    });

    for (const row of rows || []) {
      const id = clean(row?.patientId);
      if (id) ids.add(id);
    }
  }

  return Array.from(ids);
}

async function handleReschedule(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const id = clean(ctx.params.id);

    if (!id) {
      return json({ ok: false, error: 'appointment_id_required' }, 400);
    }

    const body = await req.json().catch(() => ({} as any));
    const requestedStart = parseDate(
      body.startsAt ||
        body.starts_at ||
        body.start ||
        body.startISO,
    );

    if (!requestedStart) {
      return json({ ok: false, error: 'startsAt_required' }, 400);
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    if (!activeStatus(appointment.status)) {
      return json(
        {
          ok: false,
          error: 'appointment_not_reschedulable',
          status: appointment.status,
        },
        409,
      );
    }

    const authorization =
      await resolveAuthorizedActor(req, appointment);

    if (authorization.error) {
      return authorization.error;
    }

    const currentStart = new Date(appointment.startsAt);
    const currentEnd = new Date(appointment.endsAt);

    if (
      !Number.isFinite(currentStart.getTime()) ||
      !Number.isFinite(currentEnd.getTime()) ||
      currentEnd <= currentStart
    ) {
      return json(
        {
          ok: false,
          error: 'existing_appointment_duration_invalid',
        },
        409,
      );
    }

    const durationMin = minutesBetween(
      currentStart,
      currentEnd,
    );
    const canonicalEnd = addMinutes(
      requestedStart,
      durationMin,
    );

    const suppliedEndRaw =
      body.endsAt ||
      body.ends_at ||
      body.end ||
      body.endISO;

    if (suppliedEndRaw != null && clean(suppliedEndRaw)) {
      const suppliedEnd = parseDate(suppliedEndRaw);

      if (!suppliedEnd) {
        return json({ ok: false, error: 'invalid_endsAt' }, 400);
      }

      if (suppliedEnd.getTime() !== canonicalEnd.getTime()) {
        return json(
          {
            ok: false,
            error: 'reschedule_duration_mismatch',
            expectedDurationMin: durationMin,
            expectedEndsAt: canonicalEnd.toISOString(),
          },
          409,
        );
      }
    }

    let validation: Awaited<
      ReturnType<typeof validateAvailabilityInterval>
    >;

    try {
      validation = await validateAvailabilityInterval({
        clinicianRef: appointment.clinicianId,
        startsAt: requestedStart,
        endsAt: canonicalEnd,
        consultType: appointment.kind,
        caseId: appointment.caseId || null,
        allowExtendedDuration: true,
        excludeAppointmentId: id,
        enforceBookability: true,
        enforceAdvanceWindow: true,
        enforceConflicts: true,
      });
    } catch (error: any) {
      if (error instanceof AvailabilityError) {
        return json(
          {
            ok: false,
            error: 'selected_slot_not_bookable',
            canonicalAvailabilityError: error.code,
            details: error.details,
          },
          error.status,
        );
      }

      throw error;
    }

    const recipientPatientIds =
      await loadRecipientPatientIds(prisma as any, appointment);

    const conflicts = await findMultiCareConflicts({
      clinicianId: appointment.clinicianId,
      hostUserId: clean(appointment.hostUserId),
      actorPatientId:
        clean(appointment.patientId) ||
        clean(appointment.subjectPatientId),
      recipientPatientIds,
      startsAt: requestedStart,
      endsAt: canonicalEnd,
      excludeAppointmentId: id,
    });

    if (conflicts.clinicianConflict) {
      return json(
        {
          ok: false,
          error: 'CONFLICT',
          conflict: {
            scope: 'clinician',
            with: conflicts.clinicianConflict,
          },
        },
        409,
      );
    }

    if (conflicts.patientConflict) {
      return json(
        {
          ok: false,
          error: 'CONFLICT',
          conflict: {
            scope: 'patient',
            with: conflicts.patientConflict,
          },
        },
        409,
      );
    }

    const now = new Date();

    const out = await prisma.$transaction(
      async (tx: any) => {
        const current =
          await tx.appointment.findUnique({
            where: { id },
          });

        if (!current) {
          return { error: 'not_found' } as const;
        }

        if (!activeStatus(current.status)) {
          return {
            error: 'appointment_not_reschedulable',
          } as const;
        }

        if (
          new Date(current.startsAt).getTime() !==
            currentStart.getTime() ||
          new Date(current.endsAt).getTime() !==
            currentEnd.getTime()
        ) {
          return {
            error: 'appointment_changed_retry',
          } as const;
        }

        const txRecipientPatientIds =
          await loadRecipientPatientIds(tx, current);

        const txConflicts =
          await findMultiCareConflicts({
            db: tx,
            clinicianId: current.clinicianId,
            hostUserId: clean(current.hostUserId),
            actorPatientId:
              clean(current.patientId) ||
              clean(current.subjectPatientId),
            recipientPatientIds:
              txRecipientPatientIds,
            startsAt: requestedStart,
            endsAt: canonicalEnd,
            excludeAppointmentId: id,
          });

        if (txConflicts.clinicianConflict) {
          return {
            conflict: {
              scope: 'clinician',
              with: txConflicts.clinicianConflict,
            },
          } as const;
        }

        if (txConflicts.patientConflict) {
          return {
            conflict: {
              scope: 'patient',
              with: txConflicts.patientConflict,
            },
          } as const;
        }

        const bufferedClinicianConflict =
          await tx.appointment.findFirst({
            where: {
              id: { not: id },
              clinicianId: current.clinicianId,
              startsAt: {
                lt: addMinutes(
                  canonicalEnd,
                  validation.bufferMin,
                ),
              },
              endsAt: {
                gt: addMinutes(
                  requestedStart,
                  -validation.bufferMin,
                ),
              },
              status: { notIn: INACTIVE_STATUSES },
            },
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
            },
          });

        if (bufferedClinicianConflict) {
          return {
            conflict: {
              scope: 'clinician',
              with: bufferedClinicianConflict,
            },
          } as const;
        }

        const currentMeta = readMeta(current.meta);
        const currentSlotContract =
          readMeta(currentMeta.slotContract);

        const nextMeta = {
          ...currentMeta,
          slotContract: {
            ...currentSlotContract,
            source: 'server_revalidated_reschedule',
            status: validation.status,
            utcStart: requestedStart.toISOString(),
            requestedUtcEnd: canonicalEnd.toISOString(),
            utcEnd: canonicalEnd.toISOString(),
            localStart: validation.localStart,
            localEnd: validation.localEnd,
            localDate: validation.localDate,
            localStartTime: validation.localStartTime,
            localEndTime: validation.localEndTime,
            localTimeLabel: validation.localTimeLabel,
            timezone: validation.timezone,
            durationMin,
            bufferMin: validation.bufferMin,
            availabilitySource:
              'api_gateway_canonical_availability_v1',
            scheduleMatchedUserId:
              validation.contract.scheduleMatchedUserId,
          },
          lastReschedule: {
            at: now.toISOString(),
            byRole: authorization.role,
            fromStartsAt: currentStart.toISOString(),
            fromEndsAt: currentEnd.toISOString(),
            toStartsAt: requestedStart.toISOString(),
            toEndsAt: canonicalEnd.toISOString(),
          },
        };

        const updated =
          await tx.appointment.update({
            where: { id },
            data: {
              startsAt: requestedStart,
              endsAt: canonicalEnd,
              status: 'pending',
              confirmedAt: null,
              meta: nextMeta as any,
            },
          });

        if (tx.televisit?.findFirst) {
          const visit = await tx.televisit.findFirst({
            where: { appointmentId: id },
            select: {
              id: true,
              scheduledStartAt: true,
              scheduledEndAt: true,
              joinOpensAt: true,
              joinClosesAt: true,
            },
          });

          if (visit) {
            const visitStart =
              visit.scheduledStartAt
                ? new Date(visit.scheduledStartAt)
                : null;
            const visitEnd =
              visit.scheduledEndAt
                ? new Date(visit.scheduledEndAt)
                : null;
            const joinOpen =
              visit.joinOpensAt
                ? new Date(visit.joinOpensAt)
                : null;
            const joinClose =
              visit.joinClosesAt
                ? new Date(visit.joinClosesAt)
                : null;

            const openLeadMs =
              visitStart &&
              joinOpen &&
              Number.isFinite(visitStart.getTime()) &&
              Number.isFinite(joinOpen.getTime())
                ? Math.max(
                    0,
                    visitStart.getTime() -
                      joinOpen.getTime(),
                  )
                : 0;

            const closeLagMs =
              visitEnd &&
              joinClose &&
              Number.isFinite(visitEnd.getTime()) &&
              Number.isFinite(joinClose.getTime())
                ? Math.max(
                    0,
                    joinClose.getTime() -
                      visitEnd.getTime(),
                  )
                : 0;

            await tx.televisit.update({
              where: { id: visit.id },
              data: {
                scheduledStartAt: requestedStart,
                scheduledEndAt: canonicalEnd,
                ...(visit.joinOpensAt
                  ? {
                      joinOpensAt: new Date(
                        requestedStart.getTime() -
                          openLeadMs,
                      ),
                    }
                  : {}),
                ...(visit.joinClosesAt
                  ? {
                      joinClosesAt: new Date(
                        canonicalEnd.getTime() +
                          closeLagMs,
                      ),
                    }
                  : {}),
              } as any,
            });
          }
        }

        return { updated } as const;
      },
    );

    if ('error' in out) {
      const status =
        out.error === 'not_found'
          ? 404
          : 409;

      return json(
        { ok: false, error: out.error },
        status,
      );
    }

    if ('conflict' in out) {
      return json(
        {
          ok: false,
          error: 'CONFLICT',
          conflict: out.conflict,
        },
        409,
      );
    }

    return json(out.updated);
  } catch (error: any) {
    console.error(
      '[api-gateway] appointment reschedule failed',
      error,
    );

    return json(
      {
        ok: false,
        error: error?.message || 'reschedule_failed',
      },
      500,
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  return handleReschedule(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  return handleReschedule(req, ctx);
}
