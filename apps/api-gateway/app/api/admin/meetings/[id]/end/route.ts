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
  meetingRoomServiceClient,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';
import {
  canTransitionMeetingState,
  type MeetingState,
} from '@/src/lib/admin-meetings-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);
    requireMeetingModeration(access);

    if (access.meeting.state === 'ENDED') {
      return NextResponse.json({ ok: true, meeting: access.meeting });
    }

    if (!canTransitionMeetingState(access.meeting.state as MeetingState, 'ENDED')) {
      return NextResponse.json(
        { ok: false, error: 'meeting_must_be_live_to_end' },
        { status: 409 },
      );
    }

    const now = new Date();

    const ended = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.meeting.updateMany({
        where: {
          id: access.meeting.id,
          state: access.meeting.state,
        },
        data: {
          state: 'ENDED',
          endedAt: now,
          lockedAt: now,
        },
      });

      if (stateUpdate.count !== 1) return false;

      await tx.meetingGuestSession.updateMany({
        where: {
          invitation: { meetingId: access.meeting.id },
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await tx.meetingParticipant.updateMany({
        where: {
          meetingId: access.meeting.id,
          state: 'JOINED',
        },
        data: {
          state: 'LEFT',
          lastLeftAt: now,
        },
      });

      return true;
    });

    if (!ended) {
      return NextResponse.json(
        { ok: false, error: 'meeting_state_conflict' },
        { status: 409 },
      );
    }

    let roomDeleted = false;
    let roomDeleteError: string | null = null;

    try {
      const client = await meetingRoomServiceClient();
      await client.deleteRoom(access.meeting.roomId);
      roomDeleted = true;
    } catch (error: any) {
      roomDeleteError = String(error?.message || error);
      console.warn('[admin meetings] LiveKit deleteRoom failed', roomDeleteError);
    }

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: 'meeting.ended',
      meetingId: access.meeting.id,
      description: 'Meeting ended for all participants',
      userAgent: request.headers.get('user-agent'),
      meta: {
        roomDeleted,
        roomDeleteError,
      },
    });

    return NextResponse.json({
      ok: true,
      meetingId: access.meeting.id,
      roomDeleted,
      roomDeleteError,
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    console.error('[admin meetings] end failed', error);
    return NextResponse.json(
      { ok: false, error: 'meeting_end_failed' },
      { status: 500 },
    );
  }
}
