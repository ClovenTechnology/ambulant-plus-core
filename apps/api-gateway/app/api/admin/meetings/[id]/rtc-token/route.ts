import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { meetingForActor } from '@/src/lib/admin-meeting-access';
import {
  mintMeetingRtcAccess,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);

    if (!access.actorParticipant) {
      return NextResponse.json(
        { ok: false, error: 'meeting_participant_required' },
        { status: 403 },
      );
    }

    if (access.actorParticipant.state === 'REMOVED' || access.actorParticipant.state === 'DECLINED') {
      return NextResponse.json(
        { ok: false, error: 'meeting_participation_inactive' },
        { status: 403 },
      );
    }

    // RTC identity is derived server-side from the canonical staff participant.
    // The browser is never allowed to choose or impersonate a LiveKit identity.
    const minted = await mintMeetingRtcAccess({
      meeting: access.meeting,
      participant: access.actorParticipant,
      identity: `meeting:${access.meeting.id}:staff:${actor.profileId}`,
      displayName: actor.name || actor.email,
    });

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.meetingParticipant.update({
        where: { id: access.actorParticipant!.id },
        data: {
          state: 'JOINED',
          firstJoinedAt: access.actorParticipant!.firstJoinedAt || now,
        },
      });

      if (access.meeting.state === 'SCHEDULED' || access.meeting.state === 'RINGING') {
        await tx.meeting.updateMany({
          where: {
            id: access.meeting.id,
            state: { in: ['SCHEDULED', 'RINGING'] },
          },
          data: {
            state: 'LIVE',
            startedAt: now,
          },
        });
      }

      await tx.adminStaffPresence.upsert({
        where: { staffProfileId: actor.profileId },
        update: {
          state: 'IN_MEETING',
          lastHeartbeatAt: now,
          expiresAt: new Date(Math.max(access.meeting.endsAt.getTime() + 30 * 60_000, now.getTime() + 90_000)),
          updatedByUserId: actor.userId,
        },
        create: {
          staffProfileId: actor.profileId,
          state: 'IN_MEETING',
          lastHeartbeatAt: now,
          expiresAt: new Date(Math.max(access.meeting.endsAt.getTime() + 30 * 60_000, now.getTime() + 90_000)),
          updatedByUserId: actor.userId,
        },
      });
    });

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: 'meeting.rtc.token_issued',
      meetingId: access.meeting.id,
      description: 'Internal participant RTC credential issued',
      userAgent: request.headers.get('user-agent'),
      meta: {
        participantId: access.actorParticipant.id,
        role: access.actorParticipant.role,
      },
    });

    return NextResponse.json({
      ok: true,
      ...minted,
      expiresInSeconds: 900,
    });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    const message = String(error?.message || '');
    const status =
      message === 'meeting_locked'
        ? 423
        : message.startsWith('meeting_')
          ? 409
          : 500;

    console.error('[admin meetings] rtc token failed', error);
    return NextResponse.json(
      { ok: false, error: message || 'meeting_rtc_token_failed' },
      { status },
    );
  }
}
