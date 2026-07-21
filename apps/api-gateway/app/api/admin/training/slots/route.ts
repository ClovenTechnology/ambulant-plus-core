import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';
import {
  normaliseAllowedTrainingModes,
  normaliseTrainingSessions,
  publicTrainingSlot,
} from '@/src/clinicians/onboarding/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function text(value: unknown, max = 2000) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  return clean.length > max
    ? clean.slice(0, max)
    : clean;
}

function dateOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime())
    ? date
    : null;
}

function positiveInteger(
  value: unknown,
  fallback: number,
  max = 10000,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(1, Math.round(number)),
  );
}

function slotData(body: any, current?: any) {
  const sourceSessions =
    Object.prototype.hasOwnProperty.call(body, 'sessions')
      ? body.sessions
      : current?.sessions;

  let sessions =
    normaliseTrainingSessions(
      sourceSessions,
      current,
    );

  if (!sessions.length) {
    const startsAt =
      dateOrNull(body.startsAt || current?.startsAt);

    const endsAt =
      dateOrNull(body.endsAt || current?.endsAt);

    if (
      !startsAt ||
      !endsAt ||
      endsAt <= startsAt
    ) {
      throw new Error(
        'at_least_one_valid_training_session_required',
      );
    }

    sessions = [
      {
        id: 'session-1',
        dayNumber: 1,
        startAt: startsAt.toISOString(),
        endAt: endsAt.toISOString(),
        mode:
          String(body.mode || current?.mode || 'virtual')
            .toLowerCase() === 'both'
            ? 'both'
            : String(body.mode || current?.mode || '')
                .toLowerCase() === 'in_person'
              ? 'in_person'
              : 'virtual',
        meetingUrl: null,
        venueName: null,
        venueAddress: null,
        trainerName: null,
      },
    ];
  }

  sessions.sort(
    (left: any, right: any) =>
      new Date(left.startAt).getTime() -
      new Date(right.startAt).getTime(),
  );

  const startsAt =
    new Date(sessions[0].startAt);

  const endsAt =
    new Date(sessions[sessions.length - 1].endAt);

  const allowedModes =
    normaliseAllowedTrainingModes(
      body.allowedModes ??
        current?.allowedModes ??
        sessions.flatMap((session: any) =>
          session.mode === 'both'
            ? ['virtual', 'in_person']
            : [session.mode],
        ),
      body.mode || current?.mode,
    );

  const durationDays = Math.max(
    positiveInteger(
      body.durationDays,
      Math.max(
        ...sessions.map(
          (session: any) =>
            Number(session.dayNumber || 1),
        ),
      ),
      365,
    ),
    Math.max(
      ...sessions.map(
        (session: any) =>
          Number(session.dayNumber || 1),
      ),
    ),
  );

  const totalDurationMinutes =
    sessions.reduce(
      (sum: number, session: any) =>
        sum +
        Math.max(
          1,
          Math.round(
            (
              new Date(session.endAt).getTime() -
              new Date(session.startAt).getTime()
            ) / 60000,
          ),
        ),
      0,
    );

  const capacity =
    positiveInteger(
      body.capacity,
      Number(current?.capacity || 1),
      5000,
    );

  if (
    current &&
    capacity < Number(current.usedCount || 0)
  ) {
    throw new Error(
      'capacity_cannot_be_less_than_confirmed_bookings',
    );
  }

  const bookingOpensAt =
    dateOrNull(
      body.bookingOpensAt ??
      current?.bookingOpensAt,
    );

  const bookingClosesAt =
    dateOrNull(
      body.bookingClosesAt ??
      current?.bookingClosesAt,
    );

  if (
    bookingOpensAt &&
    bookingOpensAt >= startsAt
  ) {
    throw new Error(
      'booking_must_open_before_training_starts',
    );
  }

  if (
    bookingClosesAt &&
    bookingClosesAt > startsAt
  ) {
    throw new Error(
      'booking_must_close_no_later_than_training_start',
    );
  }

  if (
    bookingOpensAt &&
    bookingClosesAt &&
    bookingClosesAt <= bookingOpensAt
  ) {
    throw new Error(
      'booking_close_must_be_after_booking_open',
    );
  }

  return {
    title:
      text(body.title ?? current?.title, 240) ||
      'Mandatory Clinician Training',
    summary:
      text(body.summary ?? current?.summary, 2000),
    startsAt,
    endsAt,
    timezone:
      text(
        body.timezone ??
        current?.timezone,
        120,
      ) ||
      'Africa/Johannesburg',
    durationDays,
    totalDurationMinutes,
    capacity,
    mode:
      allowedModes.length > 1
        ? 'both'
        : allowedModes[0],
    allowedModes,
    sessions,
    trainerName:
      text(
        body.trainerName ??
        current?.trainerName,
        240,
      ),
    venueName:
      text(
        body.venueName ??
        current?.venueName,
        240,
      ),
    venueAddress:
      text(
        body.venueAddress ??
        current?.venueAddress,
        1000,
      ),
    virtualInstructions:
      text(
        body.virtualInstructions ??
        current?.virtualInstructions,
        2000,
      ),
    inPersonInstructions:
      text(
        body.inPersonInstructions ??
        current?.inPersonInstructions,
        2000,
      ),
    bookingOpensAt,
    bookingClosesAt,
  };
}

async function audit(
  request: NextRequest,
  admin: any,
  action: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: admin.uid || null,
        actorType: 'ADMIN',
        actorRefId: admin.uid || null,
        app: 'admin-dashboard',
        action,
        entityType: 'ClinicianTrainingSlot',
        entityId,
        description:
          'Clinician training slot control-plane update',
        ip:
          request.headers
            .get('x-forwarded-for')
            ?.split(',')[0]
            ?.trim() ||
          request.headers.get('x-real-ip') ||
          null,
        userAgent:
          request.headers.get('user-agent'),
        meta: {
          source: admin.source || null,
          ...metadata,
        },
      },
    });
  } catch (error) {
    console.warn(
      '[admin-training-slots] audit write failed',
      error,
    );
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return admin.response;

  const slots =
    await prisma.clinicianTrainingSlot.findMany({
      include: {
        onboardings: {
          select: {
            id: true,
            clinicianId: true,
            status: true,
            trainingMode: true,
          },
        },
      },
      orderBy: [
        { startsAt: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 500,
    });

  return json({
    ok: true,
    slots: slots.map((slot: any) => ({
      ...publicTrainingSlot(slot),
      status: slot.status,
      publishedAt: slot.publishedAt
        ? new Date(slot.publishedAt).toISOString()
        : null,
      createdAt: new Date(slot.createdAt).toISOString(),
      updatedAt: new Date(slot.updatedAt).toISOString(),
      participants: slot.onboardings,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) return admin.response;

    const body =
      await request.json().catch(() => ({} as any));

    const data = slotData(body);

    const slot =
      await prisma.clinicianTrainingSlot.create({
        data: {
          ...data,
          status: 'draft',
          usedCount: 0,
        },
      });

    await audit(
      request,
      admin,
      'clinician_training_slot.created',
      slot.id,
    );

    return json(
      {
        ok: true,
        slot: publicTrainingSlot(slot),
      },
      201,
    );
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          'training_slot_create_failed',
      },
      400,
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) return admin.response;

    const body =
      await request.json().catch(() => ({} as any));

    const slotId =
      String(body.id || body.slotId || '').trim();

    if (!slotId) {
      return json(
        {
          ok: false,
          error: 'slotId_required',
        },
        400,
      );
    }

    const current =
      await prisma.clinicianTrainingSlot.findUnique({
        where: {
          id: slotId,
        },
      });

    if (!current) {
      return json(
        {
          ok: false,
          error: 'training_slot_not_found',
        },
        404,
      );
    }

    const action =
      String(body.action || 'update')
        .trim()
        .toLowerCase();

    let data: any = {};

    if (action === 'update') {
      if (
        String(current.status) === 'cancelled' ||
        String(current.status) === 'completed'
      ) {
        return json(
          {
            ok: false,
            error:
              'closed_training_slot_cannot_be_edited',
          },
          409,
        );
      }

      const next =
        slotData(body, current);

      if (Number(current.usedCount || 0) > 0) {
        const currentSessions =
          normaliseTrainingSessions(
            current.sessions,
            current,
          );

        const currentModes =
          normaliseAllowedTrainingModes(
            current.allowedModes,
            current.mode,
          )
            .slice()
            .sort()
            .join('|');

        const nextModes =
          next.allowedModes
            .slice()
            .sort()
            .join('|');

        const coreScheduleChanged =
          next.startsAt.getTime() !==
            new Date(current.startsAt).getTime() ||
          next.endsAt.getTime() !==
            new Date(current.endsAt).getTime() ||
          next.durationDays !==
            Number(current.durationDays || 1) ||
          JSON.stringify(next.sessions) !==
            JSON.stringify(currentSessions) ||
          currentModes !== nextModes;

        if (coreScheduleChanged) {
          return json(
            {
              ok: false,
              error:
                'booked_training_programme_schedule_cannot_be_changed',
            },
            409,
          );
        }
      }

      data = next;
    } else if (action === 'publish') {
      if (new Date(current.endsAt).getTime() <= Date.now()) {
        return json(
          {
            ok: false,
            error:
              'past_training_slot_cannot_be_published',
          },
          409,
        );
      }

      if (Number(current.capacity) <= Number(current.usedCount)) {
        return json(
          {
            ok: false,
            error:
              'training_slot_has_no_available_capacity',
          },
          409,
        );
      }

      data = {
        status: 'published',
        publishedAt: new Date(),
        publishedByUserId: admin.uid,
        cancelledAt: null,
        cancelledByUserId: null,
      };
    } else if (
      action === 'unpublish'
    ) {
      if (Number(current.usedCount || 0) > 0) {
        return json(
          {
            ok: false,
            error:
              'booked_training_slot_cannot_be_unpublished',
          },
          409,
        );
      }

      data = {
        status: 'draft',
        publishedAt: null,
        publishedByUserId: null,
      };
    } else if (action === 'complete') {
      data = {
        status: 'completed',
      };
    } else if (
      action === 'cancel' ||
      action === 'cancelled'
    ) {
      if (
        Number(current.usedCount || 0) > 0 &&
        body.confirmParticipantImpact !== true
      ) {
        return json(
          {
            ok: false,
            error:
              'confirm_participant_impact_before_cancelling',
          },
          409,
        );
      }

      data = {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledByUserId: admin.uid,
      };
    } else {
      return json(
        {
          ok: false,
          error:
            'unsupported_training_slot_action',
        },
        400,
      );
    }

    const slot =
      await prisma.clinicianTrainingSlot.update({
        where: {
          id: slotId,
        },
        data,
      });

    await audit(
      request,
      admin,
      `clinician_training_slot.${action}`,
      slot.id,
      {
        previousStatus: current.status,
        nextStatus: slot.status,
      },
    );

    return json({
      ok: true,
      slot: publicTrainingSlot(slot),
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          'training_slot_update_failed',
      },
      400,
    );
  }
}
