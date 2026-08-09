import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  meetingForActor,
  requireMeetingModeration,
} from '@/src/lib/admin-meeting-access';
import {
  cleanMeetingText,
  publicMeetingSummary,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';
import {
  canTransitionMeetingState,
  clampMeetingDurationMinutes,
  isMeetingState,
  type MeetingState,
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);

    return json({
      ok: true,
      meeting: {
        ...access.meeting,
        publicSummary: publicMeetingSummary(access.meeting),
      },
      permissions: {
        canModerate: access.canModerate,
        canReadAudit: access.canReadAudit,
        actorParticipantId: access.actorParticipant?.id || null,
        actorRole: access.actorParticipant?.role || null,
      },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin meetings] detail failed', error);
    return json({ ok: false, error: 'meeting_detail_failed' }, 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);
    requireMeetingModeration(access);

    const body = await request.json().catch(() => ({} as any));
    const current = access.meeting;
    const applicationInterviewManaged =
      current.kind === 'INTERVIEW' &&
      current.contextType === 'APPLICATION_INTERVIEW' &&
      Boolean(current.contextId);

    if (applicationInterviewManaged) {
      const forbiddenKeys = Object.keys(body).filter((key) => key !== 'locked');
      if (forbiddenKeys.length > 0) {
        return json(
          { ok: false, error: 'application_interview_managed_from_application_workspace' },
          409,
        );
      }
    }

    const data: any = {};

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = cleanMeetingText(body.title, 240);
      if (!title) return json({ ok: false, error: 'meeting_title_required' }, 400);
      data.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'agenda')) {
      data.agenda = cleanMeetingText(body.agenda, 8000) || null;
    }

    let timezone = current.timezone;
    if (Object.prototype.hasOwnProperty.call(body, 'timezone')) {
      timezone = cleanMeetingText(body.timezone, 120);
      if (!validMeetingTimezone(timezone)) {
        return json({ ok: false, error: 'invalid_meeting_timezone' }, 400);
      }
      data.timezone = timezone;
    }

    const hasLocalStart = Object.prototype.hasOwnProperty.call(body, 'startsAtLocal');
    const hasAbsoluteStart = Object.prototype.hasOwnProperty.call(body, 'startsAt');

    if (hasLocalStart || hasAbsoluteStart) {
      const startsAt = hasLocalStart
        ? zonedLocalMeetingStart(cleanMeetingText(body.startsAtLocal, 40), timezone)
        : new Date(cleanMeetingText(body.startsAt, 120));

      if (!startsAt || !Number.isFinite(startsAt.getTime())) {
        return json({ ok: false, error: 'invalid_meeting_start' }, 400);
      }

      const duration = Object.prototype.hasOwnProperty.call(body, 'durationMinutes')
        ? clampMeetingDurationMinutes(body.durationMinutes)
        : current.durationMinutes;

      data.startsAt = startsAt;
      data.durationMinutes = duration;
      data.endsAt = new Date(startsAt.getTime() + duration * 60_000);
    } else if (Object.prototype.hasOwnProperty.call(body, 'durationMinutes')) {
      const duration = clampMeetingDurationMinutes(body.durationMinutes);
      data.durationMinutes = duration;
      data.endsAt = new Date(current.startsAt.getTime() + duration * 60_000);
    }

    for (const key of [
      'allowAudio',
      'allowVideo',
      'allowChat',
      'allowFiles',
      'allowScreenShare',
      'lobbyRequired',
    ]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        data[key] = body[key] === true;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'allowRecording')) {
      data.allowRecording =
        body.allowRecording === true &&
        (actor.isSuperAdmin || actor.scopes.includes('meetings.record'));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'locked')) {
      data.lockedAt = body.locked === true ? new Date() : null;
    }

    let requestedState: MeetingState | null = null;

    if (Object.prototype.hasOwnProperty.call(body, 'state')) {
      const nextText = cleanMeetingText(body.state, 40).toUpperCase();
      if (!isMeetingState(nextText)) {
        return json({ ok: false, error: 'invalid_meeting_state' }, 400);
      }

      requestedState = nextText;
      if (!canTransitionMeetingState(current.state as MeetingState, requestedState)) {
        return json({ ok: false, error: 'invalid_meeting_state_transition' }, 409);
      }

      data.state = requestedState;

      if (requestedState === 'CANCELLED') {
        const reason = cleanMeetingText(body.reason, 1000);
        if (!reason) return json({ ok: false, error: 'cancellation_reason_required' }, 400);
        data.cancelledAt = new Date();
        data.cancelledByProfileId = actor.profileId;
        data.cancellationReason = reason;
      }
    }

    if (Object.keys(data).length === 0) {
      return json({ ok: false, error: 'meeting_update_empty' }, 400);
    }

    let meeting: any;

    if (requestedState) {
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.meeting.updateMany({
          where: {
            id: current.id,
            state: current.state,
          },
          data,
        });

        if (result.count !== 1) return null;

        if (requestedState === 'CANCELLED') {
          const now = new Date();
          await tx.meetingGuestSession.updateMany({
            where: {
              invitation: { meetingId: current.id },
              revokedAt: null,
            },
            data: { revokedAt: now },
          });
        }

        return tx.meeting.findUnique({ where: { id: current.id } });
      });

      if (!updated) {
        return json({ ok: false, error: 'meeting_state_conflict' }, 409);
      }

      meeting = updated;
    } else {
      meeting = await prisma.meeting.update({
        where: { id: current.id },
        data,
      });
    }

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action:
        data.state === 'CANCELLED'
          ? 'meeting.cancelled'
          : data.lockedAt !== undefined
            ? data.lockedAt
              ? 'meeting.locked'
              : 'meeting.unlocked'
            : 'meeting.updated',
      meetingId: current.id,
      description: data.state === 'CANCELLED' ? 'Meeting cancelled' : 'Meeting updated',
      userAgent: request.headers.get('user-agent'),
      meta: {
        changedFields: Object.keys(data),
        cancellationReason: data.cancellationReason || null,
      },
    });

    return json({ ok: true, meeting });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin meetings] update failed', error);
    return json({ ok: false, error: 'meeting_update_failed' }, 500);
  }
}
