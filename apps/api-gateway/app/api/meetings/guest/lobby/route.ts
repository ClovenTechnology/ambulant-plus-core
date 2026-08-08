import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
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

    if (meeting.lockedAt) {
      return NextResponse.json(
        { ok: false, error: 'meeting_locked' },
        { status: 423 },
      );
    }

    const existing = await prisma.meetingLobbyEntry.findUnique({
      where: {
        meetingId_participantId: {
          meetingId: meeting.id,
          participantId: invitation.participantId,
        },
      },
    });

    if (existing?.state === 'REJECTED') {
      return NextResponse.json(
        { ok: false, error: 'lobby_rejected' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      );
    }

    if (existing?.state === 'ADMITTED') {
      return NextResponse.json(
        { ok: true, lobby: existing },
        { headers: { 'cache-control': 'no-store' } },
      );
    }

    const state = meeting.lobbyRequired ? 'WAITING' : 'ADMITTED';
    const now = new Date();

    const entry = existing
      ? await prisma.meetingLobbyEntry.update({
          where: { id: existing.id },
          data: {
            guestSessionId: session.id,
            state,
            requestedAt: now,
            decidedAt: state === 'ADMITTED' ? now : null,
            decidedByProfileId: null,
            decisionReason: state === 'ADMITTED' ? 'lobby_not_required' : null,
          },
        })
      : await prisma.meetingLobbyEntry.create({
          data: {
            meetingId: meeting.id,
            participantId: invitation.participantId,
            guestSessionId: session.id,
            state,
            requestedAt: now,
            decidedAt: state === 'ADMITTED' ? now : null,
            decisionReason: state === 'ADMITTED' ? 'lobby_not_required' : null,
          },
        });

    await writeMeetingAudit({
      actorType: 'EXTERNAL_GUEST',
      actorRefId: session.id,
      action: state === 'ADMITTED' ? 'meeting.guest.auto_admitted' : 'meeting.guest.lobby_requested',
      meetingId: meeting.id,
      description: state === 'ADMITTED' ? 'External guest admitted without lobby' : 'External guest entered lobby',
      userAgent: request.headers.get('user-agent'),
      meta: {
        invitationId: invitation.id,
        participantId: invitation.participantId,
        lobbyEntryId: entry.id,
      },
    });

    return NextResponse.json(
      { ok: true, lobby: entry },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('[meeting guest] lobby failed', error);
    return NextResponse.json(
      { ok: false, error: 'guest_lobby_failed' },
      { status: 500 },
    );
  }
}
