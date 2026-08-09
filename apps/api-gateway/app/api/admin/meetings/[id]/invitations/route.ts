import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import {
  meetingForActor,
  requireMeetingModeration,
} from '@/src/lib/admin-meeting-access';
import {
  cleanMeetingText,
  createExternalMeetingInvitation,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';
import {
  normaliseMeetingEmail,
  validMeetingEmail,
} from '@/src/lib/admin-meetings-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = requireStaffCapability(
      await requireAdminStaffActor(request),
      'meetings.invite_external',
    );

    const access = await meetingForActor(params.id, actor);
    requireMeetingModeration(access);

    if (
      access.meeting.kind === 'INTERVIEW' &&
      access.meeting.contextType === 'APPLICATION_INTERVIEW' &&
      access.meeting.contextId
    ) {
      return json(
        { ok: false, error: 'application_interview_managed_from_application_workspace' },
        409,
      );
    }

    if (['ENDED', 'CANCELLED', 'EXPIRED'].includes(access.meeting.state)) {
      return json({ ok: false, error: 'meeting_closed' }, 409);
    }

    const body = await request.json().catch(() => ({} as any));
    const email = normaliseMeetingEmail(body?.email);

    if (!validMeetingEmail(email)) {
      return json({ ok: false, error: 'invalid_external_email' }, 400);
    }

    const duplicate = await prisma.meetingParticipant.findFirst({
      where: {
        meetingId: access.meeting.id,
        participantType: 'EXTERNAL_GUEST',
        emailNormalized: email,
        removedAt: null,
      },
    });

    if (duplicate) {
      return json({ ok: false, error: 'guest_already_invited' }, 409);
    }

    const created = await createExternalMeetingInvitation({
      meeting: access.meeting,
      email,
      displayName: cleanMeetingText(body?.displayName, 240) || null,
      role:
        cleanMeetingText(body?.role, 40).toUpperCase() === 'INTERVIEWEE'
          ? 'INTERVIEWEE'
          : cleanMeetingText(body?.role, 40).toUpperCase() === 'PRESENTER'
            ? 'PRESENTER'
            : 'ATTENDEE',
      createdByProfileId: actor.profileId,
      requirePin: body?.requirePin === true,
      pin: cleanMeetingText(body?.pin, 32) || null,
      subjectOverride: cleanMeetingText(body?.subjectOverride, 240) || null,
      messageOverride: cleanMeetingText(body?.messageOverride, 4000) || null,
      templateKey: cleanMeetingText(body?.templateKey, 120) || null,
      templateVersion: cleanMeetingText(body?.templateVersion, 80) || null,
      sendEmail: body?.sendEmail !== false,
    });

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: 'meeting.guest.invited',
      meetingId: access.meeting.id,
      description: 'External guest invited',
      userAgent: request.headers.get('user-agent'),
      meta: {
        invitationId: created.invitation.id,
        participantId: created.participant.id,
        email,
        requiresPin: Boolean(created.invitation.pinHash),
      },
    });

    return json({
      ok: true,
      invitation: {
        id: created.invitation.id,
        email: created.invitation.emailNormalized,
        state: created.invitation.state,
        expiresAt: created.invitation.expiresAt,
        emailDelivery: created.emailDelivery,
        oneTime: created.oneTime,
      },
    }, 201);
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin meetings] invitation failed', error);
    return json({ ok: false, error: 'meeting_invitation_failed' }, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = requireStaffCapability(
      await requireAdminStaffActor(request),
      'meetings.invite_external',
    );

    const access = await meetingForActor(params.id, actor);
    requireMeetingModeration(access);

    if (
      access.meeting.kind === 'INTERVIEW' &&
      access.meeting.contextType === 'APPLICATION_INTERVIEW' &&
      access.meeting.contextId
    ) {
      return json(
        { ok: false, error: 'application_interview_managed_from_application_workspace' },
        409,
      );
    }

    const body = await request.json().catch(() => ({} as any));
    const invitationId = cleanMeetingText(body?.invitationId, 240);
    if (!invitationId) return json({ ok: false, error: 'invitation_id_required' }, 400);

    const invitation = await prisma.meetingInvitation.findFirst({
      where: { id: invitationId, meetingId: access.meeting.id },
    });

    if (!invitation) return json({ ok: false, error: 'invitation_not_found' }, 404);

    const now = new Date();
    await prisma.$transaction([
      prisma.meetingInvitation.update({
        where: { id: invitation.id },
        data: { state: 'REVOKED', revokedAt: now },
      }),
      prisma.meetingGuestSession.updateMany({
        where: { invitationId: invitation.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.meetingParticipant.update({
        where: { id: invitation.participantId },
        data: { state: 'REMOVED', removedAt: now },
      }),
    ]);

    await writeMeetingAudit({
      actorUserId: actor.userId,
      actorRefId: actor.profileId,
      action: 'meeting.guest.invitation.revoked',
      meetingId: access.meeting.id,
      description: 'External guest invitation revoked',
      userAgent: request.headers.get('user-agent'),
      meta: { invitationId },
    });

    return json({ ok: true });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[admin meetings] revoke invitation failed', error);
    return json({ ok: false, error: 'meeting_invitation_revoke_failed' }, 500);
  }
}
