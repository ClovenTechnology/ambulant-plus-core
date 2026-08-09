import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { meetingForActor } from '@/src/lib/admin-meeting-access';
import { cleanMeetingText, writeMeetingAudit } from '@/src/lib/admin-meetings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    await meetingForActor(params.id, actor);
    const messages = await prisma.meetingChatMessage.findMany({
      where: { meetingId: params.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 250,
      include: {
        senderProfile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
    });
    return json({ ok: true, messages, actorProfileId: actor.profileId });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[meeting chat] GET failed', error);
    return json({ ok: false, error: 'meeting_chat_failed' }, 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const access = await meetingForActor(params.id, actor);
    if (!access.actorParticipant) return json({ ok: false, error: 'meeting_participant_required' }, 403);
    if (!access.meeting.allowChat) return json({ ok: false, error: 'meeting_chat_disabled' }, 409);
    if (['ENDED', 'CANCELLED', 'EXPIRED'].includes(access.meeting.state)) {
      return json({ ok: false, error: 'meeting_chat_closed' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const text = cleanMeetingText(body?.body, 8000);
    if (!text) return json({ ok: false, error: 'meeting_chat_body_required' }, 400);

    const message = await prisma.meetingChatMessage.create({
      data: { meetingId: params.id, senderProfileId: actor.profileId, body: text },
      include: {
        senderProfile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
    });

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: 'meeting.chat.message_created',
      meetingId: params.id,
      description: 'Persistent internal meeting message created',
      userAgent: request.headers.get('user-agent'),
      meta: { messageId: message.id },
    });

    return json({ ok: true, message }, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[meeting chat] POST failed', error);
    return json({ ok: false, error: 'meeting_chat_failed' }, 500);
  }
}
