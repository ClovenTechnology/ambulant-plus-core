import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  mintMeetingRtcAccess,
  parseGuestSessionHeader,
  resolveGuestSession,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = parseGuestSessionHeader(request.headers);
    const session = await resolveGuestSession(token);

    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'guest_session_required' },
        { status: 401 },
      );
    }

    const invitation = session.invitation;
    const meeting = invitation.meeting;
    const participant = invitation.participant;

    if (participant.state === 'REMOVED' || participant.state === 'DECLINED') {
      return NextResponse.json(
        { ok: false, error: 'meeting_participation_inactive' },
        { status: 403 },
      );
    }

    const lobby = await prisma.meetingLobbyEntry.findUnique({
      where: {
        meetingId_participantId: {
          meetingId: meeting.id,
          participantId: participant.id,
        },
      },
    });

    if (meeting.lobbyRequired && lobby?.state !== 'ADMITTED') {
      return NextResponse.json(
        { ok: false, error: 'lobby_admission_required' },
        { status: 403 },
      );
    }

    const minted = await mintMeetingRtcAccess({
      meeting,
      participant,
      identity: `meeting:${meeting.id}:guest:${participant.id}`,
      displayName: participant.displayName,
    });

    const now = new Date();
    await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: {
        state: 'JOINED',
        firstJoinedAt: participant.firstJoinedAt || now,
      },
    });

    if (meeting.state === 'SCHEDULED' || meeting.state === 'RINGING') {
      await prisma.meeting.updateMany({
        where: {
          id: meeting.id,
          state: { in: ['SCHEDULED', 'RINGING'] },
        },
        data: {
          state: 'LIVE',
          startedAt: now,
        },
      });
    }

    await writeMeetingAudit({
      actorType: 'EXTERNAL_GUEST',
      actorRefId: session.id,
      action: 'meeting.guest.rtc_token_issued',
      meetingId: meeting.id,
      description: 'External guest RTC credential issued',
      userAgent: request.headers.get('user-agent'),
      meta: {
        participantId: participant.id,
        invitationId: invitation.id,
      },
    });

    return NextResponse.json({
      ok: true,
      ...minted,
      expiresInSeconds: 900,
    });
  } catch (error: any) {
    const message = String(error?.message || '');
    const status =
      message === 'meeting_locked'
        ? 423
        : message.startsWith('meeting_')
          ? 409
          : 500;

    console.error('[meeting guest] rtc token failed', error);
    return NextResponse.json(
      { ok: false, error: message || 'guest_rtc_token_failed' },
      { status },
    );
  }
}
