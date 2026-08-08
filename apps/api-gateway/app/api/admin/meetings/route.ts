import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';
import {
  cleanMeetingText,
  createExternalMeetingInvitation,
  randomOpaqueToken,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';
import {
  clampMeetingDurationMinutes,
  isMeetingState,
  normaliseMeetingEmail,
  validMeetingEmail,
  validMeetingTimezone,
  zonedLocalMeetingStart,
} from '@/src/lib/admin-meetings-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function uniqueStrings(value: unknown, max = 100) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return Array.from(
    new Set(values.map((item) => cleanMeetingText(item, 320)).filter(Boolean)),
  ).slice(0, max);
}

function uniqueEmails(value: unknown, max = 100) {
  return Array.from(
    new Set(
      uniqueStrings(value, max)
        .map(normaliseMeetingEmail)
        .filter(Boolean),
    ),
  ).slice(0, max);
}

function resolveMeetingStart(body: any, kind: string, timezone: string) {
  if (kind === 'DIRECT_CALL') return new Date();

  const localStart = cleanMeetingText(body?.startsAtLocal, 40);
  if (localStart) {
    return zonedLocalMeetingStart(localStart, timezone);
  }

  const startsAt = new Date(cleanMeetingText(body?.startsAt, 120));
  return Number.isFinite(startsAt.getTime()) ? startsAt : null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const canReadAll =
      hasStaffCapability(actor, 'meetings.moderate') ||
      hasStaffCapability(actor, 'meetings.audit.read');

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number(request.nextUrl.searchParams.get('pageSize') || '30') || 30),
    );
    const stateText = cleanMeetingText(request.nextUrl.searchParams.get('state'), 40).toUpperCase();
    const search = cleanMeetingText(request.nextUrl.searchParams.get('q'), 240);

    if (stateText && !isMeetingState(stateText)) {
      return json({ ok: false, error: 'invalid_meeting_state' }, 400);
    }

    const where: any = {
      ...(stateText ? { state: stateText } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { agenda: { contains: search, mode: 'insensitive' } },
              { contextId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(!canReadAll
        ? {
            participants: {
              some: { staffProfileId: actor.profileId },
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          participants: {
            select: {
              id: true,
              participantType: true,
              staffProfileId: true,
              emailNormalized: true,
              displayName: true,
              role: true,
              state: true,
            },
          },
        },
      }),
    ]);

    return json({
      ok: true,
      page,
      pageSize,
      total,
      items: rows.map((row) => ({
        ...row,
        locked: Boolean(row.lockedAt),
      })),
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin meetings] list failed', error);
    return json({ ok: false, error: 'meeting_list_failed' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = requireStaffCapability(
      await requireAdminStaffActor(request),
      'meetings.create',
    );

    const body = await request.json().catch(() => ({} as any));
    const title = cleanMeetingText(body?.title, 240);
    const agenda = cleanMeetingText(body?.agenda, 8000) || null;
    const timezone = cleanMeetingText(body?.timezone, 120) || 'Africa/Johannesburg';
    const kind = cleanMeetingText(body?.kind, 40).toUpperCase() || 'STANDARD';
    const durationMinutes = clampMeetingDurationMinutes(body?.durationMinutes);

    if (!title) return json({ ok: false, error: 'meeting_title_required' }, 400);
    if (!['STANDARD', 'DIRECT_CALL', 'INTERVIEW'].includes(kind)) {
      return json({ ok: false, error: 'invalid_meeting_kind' }, 400);
    }
    if (!validMeetingTimezone(timezone)) {
      return json({ ok: false, error: 'invalid_meeting_timezone' }, 400);
    }

    const startsAt = resolveMeetingStart(body, kind, timezone);
    if (!startsAt || !Number.isFinite(startsAt.getTime())) {
      return json({ ok: false, error: 'invalid_meeting_start' }, 400);
    }

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const staffProfileIds = uniqueStrings(body?.staffProfileIds, 100)
      .filter((id) => id !== actor.profileId);
    const externalEmails = uniqueEmails(body?.externalEmails, 100);

    if (externalEmails.some((email) => !validMeetingEmail(email))) {
      return json({ ok: false, error: 'invalid_external_email' }, 400);
    }

    if (
      externalEmails.length > 0 &&
      !hasStaffCapability(actor, 'meetings.invite_external')
    ) {
      return json({ ok: false, error: 'meeting_external_invite_scope_required' }, 403);
    }

    const staff = staffProfileIds.length
      ? await prisma.adminUserProfile.findMany({
          where: {
            id: { in: staffProfileIds },
            lifecycleState: { in: ['ACTIVE', 'LEAVE'] },
          },
          select: {
            id: true,
            name: true,
            email: true,
            lifecycleState: true,
          },
        })
      : [];

    const found = new Set(staff.map((item) => item.id));
    const invalidStaffProfileIds = staffProfileIds.filter((id) => !found.has(id));

    if (invalidStaffProfileIds.length > 0) {
      return json({
        ok: false,
        error: 'invalid_staff_participants',
        invalidStaffProfileIds,
      }, 400);
    }

    const state = kind === 'DIRECT_CALL' ? 'RINGING' : 'SCHEDULED';
    const roomId = `meeting-${randomOpaqueToken(18)}`;

    const meeting = await prisma.$transaction(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          roomId,
          kind: kind as any,
          state: state as any,
          title,
          agenda,
          timezone,
          startsAt,
          endsAt,
          durationMinutes,
          createdByProfileId: actor.profileId,
          hostProfileId: actor.profileId,
          contextType: cleanMeetingText(body?.contextType, 80) || null,
          contextId: cleanMeetingText(body?.contextId, 240) || null,
          allowAudio: body?.allowAudio !== false,
          allowVideo: body?.allowVideo !== false,
          allowChat: body?.allowChat !== false,
          allowFiles: body?.allowFiles !== false,
          allowScreenShare: body?.allowScreenShare !== false,
          allowRecording:
            body?.allowRecording === true &&
            hasStaffCapability(actor, 'meetings.record'),
          lobbyRequired: body?.lobbyRequired !== false,
        },
      });

      await tx.meetingParticipant.create({
        data: {
          meetingId: created.id,
          participantType: 'INTERNAL_STAFF',
          staffProfileId: actor.profileId,
          emailNormalized: normaliseMeetingEmail(actor.email),
          displayName: actor.name || actor.email,
          role: 'HOST',
          state: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      if (staff.length) {
        await tx.meetingParticipant.createMany({
          data: staff.map((item) => ({
            meetingId: created.id,
            participantType: 'INTERNAL_STAFF' as const,
            staffProfileId: item.id,
            emailNormalized: normaliseMeetingEmail(item.email),
            displayName: item.name || item.email,
            role: 'ATTENDEE' as const,
            state: 'INVITED' as const,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    const externalInvitations: any[] = [];

    for (const email of externalEmails) {
      try {
        externalInvitations.push(
          await createExternalMeetingInvitation({
            meeting,
            email,
            role: kind === 'INTERVIEW' ? 'INTERVIEWEE' : 'ATTENDEE',
            createdByProfileId: actor.profileId,
            requirePin: body?.requireGuestPin === true,
            subjectOverride: cleanMeetingText(body?.subjectOverride, 240) || null,
            messageOverride: cleanMeetingText(body?.messageOverride, 4000) || null,
            templateKey: cleanMeetingText(body?.templateKey, 120) || null,
            templateVersion: cleanMeetingText(body?.templateVersion, 80) || null,
            sendEmail: body?.sendEmail !== false,
          }),
        );
      } catch (error) {
        console.error('[admin meetings] external invite creation failed', email, error);
        externalInvitations.push({
          email,
          error: 'external_invitation_failed',
        });
      }
    }

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: 'meeting.created',
      meetingId: meeting.id,
      description: 'Meeting created',
      userAgent: request.headers.get('user-agent'),
      meta: {
        kind,
        state,
        staffProfileIds: staff.map((item) => item.id),
        externalEmails,
        contextType: meeting.contextType,
        contextId: meeting.contextId,
      },
    });

    return json(
      {
        ok: true,
        meeting,
        externalInvitations: externalInvitations.map((entry) =>
          entry?.invitation
            ? {
                id: entry.invitation.id,
                email: entry.invitation.emailNormalized,
                expiresAt: entry.invitation.expiresAt,
                emailDelivery: entry.emailDelivery,
                oneTime: entry.oneTime,
              }
            : entry,
        ),
      },
      201,
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin meetings] create failed', error);
    return json({ ok: false, error: 'meeting_create_failed' }, 500);
  }
}
