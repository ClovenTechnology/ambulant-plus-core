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
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);
    requireMeetingModeration(access);

    const body = await request.json().catch(() => ({} as any));
    const action = cleanMeetingText(body?.action, 40).toUpperCase();

    if (!['ADMIT', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_lobby_action' },
        { status: 400 },
      );
    }

    const entry = await prisma.meetingLobbyEntry.findFirst({
      where: {
        id: params.entryId,
        meetingId: access.meeting.id,
      },
    });

    if (!entry) {
      return NextResponse.json(
        { ok: false, error: 'lobby_entry_not_found' },
        { status: 404 },
      );
    }

    const state = action === 'ADMIT' ? 'ADMITTED' : 'REJECTED';

    if (entry.state === state) {
      return NextResponse.json({ ok: true, entry });
    }

    if (entry.state !== 'WAITING') {
      return NextResponse.json(
        { ok: false, error: 'lobby_entry_already_decided' },
        { status: 409 },
      );
    }

    const decidedAt = new Date();
    const decisionReason = cleanMeetingText(body?.reason, 500) || null;
    const result = await prisma.meetingLobbyEntry.updateMany({
      where: {
        id: entry.id,
        meetingId: access.meeting.id,
        state: 'WAITING',
      },
      data: {
        state,
        decidedAt,
        decidedByProfileId: actor.profileId,
        decisionReason,
      },
    });

    if (result.count !== 1) {
      return NextResponse.json(
        { ok: false, error: 'lobby_decision_conflict' },
        { status: 409 },
      );
    }

    const updated = await prisma.meetingLobbyEntry.findUnique({
      where: { id: entry.id },
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'lobby_entry_not_found' },
        { status: 404 },
      );
    }

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: state === 'ADMITTED' ? 'meeting.lobby.admitted' : 'meeting.lobby.rejected',
      meetingId: access.meeting.id,
      description: state === 'ADMITTED' ? 'Lobby participant admitted' : 'Lobby participant rejected',
      userAgent: request.headers.get('user-agent'),
      meta: {
        lobbyEntryId: entry.id,
        participantId: entry.participantId,
        reason: updated.decisionReason,
      },
    });

    return NextResponse.json({ ok: true, entry: updated });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    console.error('[admin meetings] lobby decision failed', error);
    return NextResponse.json(
      { ok: false, error: 'meeting_lobby_decision_failed' },
      { status: 500 },
    );
  }
}
