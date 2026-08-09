import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';
import {
  deliverMeetingInvitation,
  hashOpaqueToken,
  meetingGuestJoinUrl,
  randomOpaqueToken,
} from '@/src/lib/admin-meetings';
import {
  clampMeetingDurationMinutes,
  normaliseMeetingEmail,
  validMeetingEmail,
  validMeetingTimezone,
  zonedLocalMeetingStart,
} from '@/src/lib/admin-meetings-policy';
import {
  APPLICATION_INTERVIEW_CONTEXT_TYPE,
  canApplicantRespondToApplicationInterview,
  canCancelApplicationInterview,
  canCreateApplicationInterview,
  canManageApplicationInterview,
  canResendApplicationInterviewInvitation,
  cleanApplicationInterviewText,
  uniqueApplicationInterviewProfileIds,
} from './application-interviews-policy';

export class ApplicationInterviewError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'ApplicationInterviewError';
    this.status = status;
    this.code = code;
  }
}

type InterviewActor = {
  actorType: 'ADMIN' | 'EXTERNAL_GUEST';
  actorRefId: string;
  actorUserId?: string | null;
};

type InterviewScheduleInput = {
  startsAtLocal: unknown;
  timezone: unknown;
  durationMinutes: unknown;
  interviewerProfileIds: unknown;
  title?: unknown;
  agenda?: unknown;
  applicantMessage?: unknown;
};

const ACTIVE_INTERVIEW_MEETING_STATES = ['DRAFT', 'SCHEDULED', 'RINGING', 'LIVE'] as const;
type ManageableApplicationInterviewStatus = 'INTERVIEW_INVITED' | 'INTERVIEW_SCHEDULED';

function manageableApplicationInterviewStatus(
  status: string,
): ManageableApplicationInterviewStatus | null {
  return status === 'INTERVIEW_INVITED' || status === 'INTERVIEW_SCHEDULED'
    ? status
    : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function scheduleInput(input: InterviewScheduleInput) {
  const timezone = cleanApplicationInterviewText(input.timezone, 120) || 'Africa/Johannesburg';
  if (!validMeetingTimezone(timezone)) {
    throw new ApplicationInterviewError('application_interview_timezone_invalid', 400);
  }

  const startsAt = zonedLocalMeetingStart(
    cleanApplicationInterviewText(input.startsAtLocal, 40),
    timezone,
  );
  if (!startsAt || !Number.isFinite(startsAt.getTime())) {
    throw new ApplicationInterviewError('application_interview_start_invalid', 400);
  }
  if (startsAt.getTime() <= Date.now() + 5 * 60_000) {
    throw new ApplicationInterviewError('application_interview_start_must_be_future', 400);
  }

  const durationMinutes = clampMeetingDurationMinutes(input.durationMinutes);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const interviewerProfileIds = uniqueApplicationInterviewProfileIds(input.interviewerProfileIds);

  if (interviewerProfileIds.length === 0) {
    throw new ApplicationInterviewError('application_interview_interviewer_required', 400);
  }

  return {
    timezone,
    startsAt,
    endsAt,
    durationMinutes,
    interviewerProfileIds,
    title: cleanApplicationInterviewText(input.title, 240),
    agenda: cleanApplicationInterviewText(input.agenda, 8000) || null,
    applicantMessage: cleanApplicationInterviewText(input.applicantMessage, 4000) || null,
  };
}

async function activeInterviewers(
  tx: Prisma.TransactionClient,
  profileIds: string[],
) {
  const rows = await tx.adminUserProfile.findMany({
    where: {
      id: { in: profileIds },
      lifecycleState: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      email: true,
      staffIdentifier: true,
      timezone: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = profileIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
  if (ordered.length !== profileIds.length) {
    throw new ApplicationInterviewError('application_interview_interviewer_not_assignable', 400);
  }
  return ordered;
}

function invitationExpiry(endsAt: Date) {
  return new Date(Math.max(endsAt.getTime() + 60 * 60_000, Date.now() + 60 * 60_000));
}

async function freshInvitationInTransaction(input: {
  tx: Prisma.TransactionClient;
  meeting: {
    id: string;
    endsAt: Date;
    createdByProfileId: string;
  };
  participant: {
    id: string;
    emailNormalized: string | null;
  };
  subjectOverride?: string | null;
  messageOverride?: string | null;
  preserveAcceptedState?: boolean;
}) {
  const email = normaliseMeetingEmail(input.participant.emailNormalized);
  if (!validMeetingEmail(email)) {
    throw new ApplicationInterviewError('application_interview_applicant_email_required', 409);
  }

  const now = new Date();
  const token = randomOpaqueToken(32);
  const tokenHash = hashOpaqueToken(token);

  const priorInvitations = await input.tx.meetingInvitation.findMany({
    where: {
      meetingId: input.meeting.id,
      participantId: input.participant.id,
      revokedAt: null,
    },
    select: { id: true },
  });

  if (priorInvitations.length) {
    await input.tx.meetingInvitation.updateMany({
      where: { id: { in: priorInvitations.map((item) => item.id) } },
      data: { state: 'REVOKED', revokedAt: now },
    });
    await input.tx.meetingGuestSession.updateMany({
      where: {
        invitationId: { in: priorInvitations.map((item) => item.id) },
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
  }

  await input.tx.meetingLobbyEntry.updateMany({
    where: {
      meetingId: input.meeting.id,
      participantId: input.participant.id,
    },
    data: {
      guestSessionId: null,
      state: 'WAITING',
      requestedAt: now,
      decidedAt: null,
      decidedByProfileId: null,
      decisionReason: null,
    },
  });

  if (!input.preserveAcceptedState) {
    await input.tx.meetingParticipant.update({
      where: { id: input.participant.id },
      data: {
        state: 'INVITED',
        acceptedAt: null,
        declinedAt: null,
        removedAt: null,
      },
    });
  }

  const invitation = await input.tx.meetingInvitation.create({
    data: {
      meetingId: input.meeting.id,
      participantId: input.participant.id,
      emailNormalized: email,
      tokenHash,
      state: 'PENDING',
      expiresAt: invitationExpiry(input.meeting.endsAt),
      createdByProfileId: input.meeting.createdByProfileId,
      subjectOverride: cleanApplicationInterviewText(input.subjectOverride, 240) || null,
      messageOverride: cleanApplicationInterviewText(input.messageOverride, 4000) || null,
      templateKey: 'application_interview',
      templateVersion: 'c5a-v1',
    },
  });

  return { invitation, token, email };
}

async function deliverInterviewInvitation(input: {
  meeting: {
    id: string;
    title: string;
    startsAt: Date;
    timezone: string;
    durationMinutes: number;
  };
  invitationId: string;
  token: string;
  email: string;
  applicantMessage?: string | null;
  subjectOverride?: string | null;
}) {
  return deliverMeetingInvitation({
    invitationId: input.invitationId,
    email: input.email,
    title: input.meeting.title,
    startsAt: input.meeting.startsAt,
    timezone: input.meeting.timezone,
    durationMinutes: input.meeting.durationMinutes,
    link: meetingGuestJoinUrl(input.token),
    customMessage: input.applicantMessage,
    subjectOverride: input.subjectOverride,
    meetingId: input.meeting.id,
  });
}

async function deliverPanelNotification(input: {
  eventKind: string;
  applicationId: string;
  referenceCode: string;
  opportunityTitle: string;
  meetingId: string;
  startsAt: Date;
  timezone: string;
  recipients: Array<{ email: string; name: string | null }>;
  action: 'scheduled' | 'rescheduled' | 'cancelled' | 'accepted' | 'declined';
  applicantEmail?: string | null;
}) {
  const recipients = Array.from(
    new Map(
      input.recipients
        .map((recipient) => ({
          email: normaliseMeetingEmail(recipient.email),
          name: recipient.name,
        }))
        .filter((recipient) => validMeetingEmail(recipient.email))
        .map((recipient) => [recipient.email, recipient]),
    ).values(),
  );

  if (!recipients.length) return;

  let when = input.startsAt.toISOString();
  try {
    when = new Intl.DateTimeFormat('en-ZA', {
      timeZone: input.timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(input.startsAt) + ` (${input.timezone})`;
  } catch {
    // The schedule boundary validates the timezone. Keep an ISO fallback.
  }

  for (const recipient of recipients) {
    const subject = `Application interview ${input.action} — ${input.referenceCode}`;
    const detail = input.action === 'cancelled'
      ? 'The interview has been cancelled. The application has returned to the shortlist stage.'
      : input.action === 'accepted'
        ? 'The applicant accepted the interview invitation.'
        : input.action === 'declined'
          ? 'The applicant declined this interview invitation. The application has returned to the shortlist stage.'
          : `The interview is ${input.action} for ${when}.`;
    const text = [
      `Ambulant+ application interview ${input.action}`,
      '',
      `Reference: ${input.referenceCode}`,
      `Opportunity: ${input.opportunityTitle}`,
      input.applicantEmail ? `Applicant: ${input.applicantEmail}` : null,
      '',
      detail,
    ].filter(Boolean).join('\n');
    const html = `<p><strong>${escapeHtml(input.referenceCode)}</strong> — ${escapeHtml(input.opportunityTitle)}</p><p>${escapeHtml(detail)}</p>`;

    const outbox = await prisma.notificationOutbox.create({
      data: {
        eventKind: input.eventKind,
        recipientEmail: recipient.email,
        channel: 'EMAIL',
        payload: {
          applicationId: input.applicationId,
          referenceCode: input.referenceCode,
          meetingId: input.meetingId,
          action: input.action,
        },
      },
    });

    const sent = await sendEmail(recipient.email, subject, html, text);
    await prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: sent.ok
        ? { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
        : {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: cleanApplicationInterviewText(sent.error, 1000) || 'email_delivery_failed',
          },
    });
  }
}

const interviewMeetingInclude = {
  participants: {
    include: {
      staffProfile: {
        select: {
          id: true,
          name: true,
          email: true,
          staffIdentifier: true,
          lifecycleState: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ role: 'asc' as const }, { invitedAt: 'asc' as const }],
  },
  invitations: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      participantId: true,
      emailNormalized: true,
      state: true,
      expiresAt: true,
      verifiedAt: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.MeetingInclude;

export async function latestApplicationInterview(applicationId: string) {
  return prisma.meeting.findFirst({
    where: {
      kind: 'INTERVIEW',
      contextType: APPLICATION_INTERVIEW_CONTEXT_TYPE,
      contextId: applicationId,
    },
    orderBy: [{ createdAt: 'desc' }, { startsAt: 'desc' }],
    include: interviewMeetingInclude,
  });
}

export function serializeAdminApplicationInterview(meeting: any) {
  if (!meeting) return null;
  const interviewee = meeting.participants?.find(
    (participant: any) => participant.participantType === 'EXTERNAL_GUEST' && participant.role === 'INTERVIEWEE',
  ) || null;
  const invitation = meeting.invitations?.find(
    (item: any) => !interviewee || item.participantId === interviewee.id,
  ) || null;

  return {
    id: meeting.id,
    roomId: meeting.roomId,
    state: meeting.state,
    title: meeting.title,
    agenda: meeting.agenda,
    timezone: meeting.timezone,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    durationMinutes: meeting.durationMinutes,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    cancelledAt: meeting.cancelledAt,
    cancellationReason: meeting.cancellationReason,
    interviewee: interviewee
      ? {
          participantId: interviewee.id,
          email: interviewee.emailNormalized,
          displayName: interviewee.displayName,
          state: interviewee.state,
          acceptedAt: interviewee.acceptedAt,
          declinedAt: interviewee.declinedAt,
          invitation: invitation
            ? {
                id: invitation.id,
                state: invitation.state,
                expiresAt: invitation.expiresAt,
                verifiedAt: invitation.verifiedAt,
                revokedAt: invitation.revokedAt,
                lastUsedAt: invitation.lastUsedAt,
                createdAt: invitation.createdAt,
              }
            : null,
        }
      : null,
    interviewers: (meeting.participants || [])
      .filter((participant: any) => participant.participantType === 'INTERNAL_STAFF')
      .map((participant: any) => ({
        participantId: participant.id,
        profileId: participant.staffProfileId,
        displayName: participant.displayName,
        role: participant.role,
        state: participant.state,
        staff: participant.staffProfile,
      })),
  };
}

export function serializePublicApplicationInterview(meeting: any) {
  if (!meeting) return null;
  const interviewee = meeting.participants?.find(
    (participant: any) => participant.participantType === 'EXTERNAL_GUEST' && participant.role === 'INTERVIEWEE',
  ) || null;

  return {
    id: meeting.id,
    state: meeting.state,
    title: meeting.title,
    timezone: meeting.timezone,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    durationMinutes: meeting.durationMinutes,
    updatedAt: meeting.updatedAt,
    intervieweeState: interviewee?.state || null,
    interviewers: (meeting.participants || [])
      .filter((participant: any) => participant.participantType === 'INTERNAL_STAFF' && participant.state !== 'REMOVED')
      .map((participant: any) => ({
        displayName: participant.displayName,
        role: participant.role,
      })),
  };
}

export async function listApplicationInterviewers() {
  return prisma.adminUserProfile.findMany({
    where: { lifecycleState: 'ACTIVE' },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      staffIdentifier: true,
      timezone: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
    },
  });
}

export async function scheduleApplicationInterview(input: {
  applicationId: string;
  actor: InterviewActor;
  schedule: InterviewScheduleInput;
}) {
  const schedule = scheduleInput(input.schedule);
  const now = new Date();
  const token = randomOpaqueToken(32);
  const tokenHash = hashOpaqueToken(token);

  const created = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `);
    const current = locked[0];
    if (!current) throw new ApplicationInterviewError('application_not_found', 404);
    if (!canCreateApplicationInterview(current.status)) {
      throw new ApplicationInterviewError('application_interview_schedule_not_available', 409);
    }

    const application = await tx.application.findUnique({
      where: { id: current.id },
      include: { opportunity: { select: { title: true } } },
    });
    if (!application) throw new ApplicationInterviewError('application_not_found', 404);

    const applicantEmail = normaliseMeetingEmail(application.applicantEmailNormalized);
    if (!validMeetingEmail(applicantEmail)) {
      throw new ApplicationInterviewError('application_interview_applicant_email_required', 409);
    }

    const active = await tx.meeting.findFirst({
      where: {
        kind: 'INTERVIEW',
        contextType: APPLICATION_INTERVIEW_CONTEXT_TYPE,
        contextId: application.id,
        state: { in: [...ACTIVE_INTERVIEW_MEETING_STATES] },
      },
      select: { id: true },
    });
    if (active) {
      throw new ApplicationInterviewError('application_interview_already_active', 409);
    }

    const interviewers = await activeInterviewers(tx, schedule.interviewerProfileIds);
    const host = interviewers[0];
    const title = schedule.title || `Interview — ${application.opportunity.title}`;
    const meeting = await tx.meeting.create({
      data: {
        roomId: `meeting-${randomOpaqueToken(18)}`,
        kind: 'INTERVIEW',
        state: 'SCHEDULED',
        title,
        agenda: schedule.agenda,
        timezone: schedule.timezone,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        durationMinutes: schedule.durationMinutes,
        createdByProfileId: input.actor.actorRefId,
        hostProfileId: host.id,
        contextType: APPLICATION_INTERVIEW_CONTEXT_TYPE,
        contextId: application.id,
        allowAudio: true,
        allowVideo: true,
        allowChat: true,
        allowFiles: false,
        allowScreenShare: true,
        allowRecording: false,
        lobbyRequired: true,
      },
    });

    await tx.meetingParticipant.createMany({
      data: interviewers.map((staff, index) => ({
        meetingId: meeting.id,
        participantType: 'INTERNAL_STAFF' as const,
        staffProfileId: staff.id,
        emailNormalized: normaliseMeetingEmail(staff.email),
        displayName: staff.name || staff.email,
        role: index === 0 ? ('HOST' as const) : ('COHOST' as const),
        state: 'ACCEPTED' as const,
        acceptedAt: now,
      })),
      skipDuplicates: true,
    });

    const interviewee = await tx.meetingParticipant.create({
      data: {
        meetingId: meeting.id,
        participantType: 'EXTERNAL_GUEST',
        emailNormalized: applicantEmail,
        displayName: applicantEmail,
        role: 'INTERVIEWEE',
        state: 'INVITED',
      },
    });

    const invitation = await tx.meetingInvitation.create({
      data: {
        meetingId: meeting.id,
        participantId: interviewee.id,
        emailNormalized: applicantEmail,
        tokenHash,
        state: 'PENDING',
        expiresAt: invitationExpiry(schedule.endsAt),
        createdByProfileId: input.actor.actorRefId,
        messageOverride: schedule.applicantMessage,
        templateKey: 'application_interview',
        templateVersion: 'c5a-v1',
      },
    });

    const moved = await tx.application.updateMany({
      where: { id: application.id, status: 'SHORTLISTED' },
      data: {
        status: 'INTERVIEW_INVITED',
        statusReason: null,
        statusChangedAt: now,
        lastReviewedAt: now,
      },
    });
    if (moved.count !== 1) {
      throw new ApplicationInterviewError('application_interview_state_conflict', 409);
    }

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: 'SHORTLISTED',
        toStatus: 'INTERVIEW_INVITED',
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        metadata: {
          source: 'application_interview',
          meetingId: meeting.id,
          startsAt: schedule.startsAt.toISOString(),
          timezone: schedule.timezone,
          interviewerProfileIds: interviewers.map((staff) => staff.id),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'admin-dashboard',
        action: 'application.interview.invited',
        entityType: 'Application',
        entityId: application.id,
        meta: { meetingId: meeting.id, from: 'SHORTLISTED', to: 'INTERVIEW_INVITED' },
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'api-gateway',
        action: 'meeting.created.application_interview',
        entityType: 'Meeting',
        entityId: meeting.id,
        meta: { applicationId: application.id, referenceCode: application.referenceCode },
      },
    });

    return {
      application,
      meeting,
      interviewers,
      interviewee,
      invitation,
      token,
      applicantMessage: schedule.applicantMessage,
    };
  });

  const emailDelivery = await deliverInterviewInvitation({
    meeting: created.meeting,
    invitationId: created.invitation.id,
    token: created.token,
    email: created.interviewee.emailNormalized || created.application.applicantEmailNormalized || '',
    applicantMessage: created.applicantMessage,
    subjectOverride: `Interview invitation — ${created.application.referenceCode}`,
  }).catch((error: any) => ({ ok: false, error: String(error?.message || error) }));

  await deliverPanelNotification({
    eventKind: 'application.interview.panel_scheduled',
    applicationId: created.application.id,
    referenceCode: created.application.referenceCode,
    opportunityTitle: created.application.opportunity.title,
    meetingId: created.meeting.id,
    startsAt: created.meeting.startsAt,
    timezone: created.meeting.timezone,
    recipients: created.interviewers,
    action: 'scheduled',
    applicantEmail: created.application.applicantEmailNormalized,
  }).catch(() => null);

  return {
    application: {
      id: created.application.id,
      referenceCode: created.application.referenceCode,
      applicantEmailNormalized: created.application.applicantEmailNormalized,
      opportunityTitle: created.application.opportunity.title,
    },
    meetingId: created.meeting.id,
    emailDelivery,
  };
}

export async function rescheduleApplicationInterview(input: {
  applicationId: string;
  actor: InterviewActor;
  schedule: InterviewScheduleInput;
}) {
  const schedule = scheduleInput(input.schedule);
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const lockedApplication = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `);
    const current = lockedApplication[0];
    if (!current) throw new ApplicationInterviewError('application_not_found', 404);
    const currentStatus = manageableApplicationInterviewStatus(current.status);
    if (!currentStatus || !canManageApplicationInterview(currentStatus)) {
      throw new ApplicationInterviewError('application_interview_manage_not_available', 409);
    }

    const application = await tx.application.findUnique({
      where: { id: current.id },
      include: { opportunity: { select: { title: true } } },
    });
    if (!application) throw new ApplicationInterviewError('application_not_found', 404);

    const meetings = await tx.$queryRaw<Array<{ id: string; state: string }>>(Prisma.sql`
      SELECT "id", "state"::text AS "state"
      FROM "Meeting"
      WHERE "kind"::text = 'INTERVIEW'
        AND "contextType" = ${APPLICATION_INTERVIEW_CONTEXT_TYPE}
        AND "contextId" = ${application.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE
    `);
    const lockedMeeting = meetings[0];
    if (!lockedMeeting) throw new ApplicationInterviewError('application_interview_not_found', 404);
    if (lockedMeeting.state !== 'SCHEDULED' && lockedMeeting.state !== 'RINGING') {
      throw new ApplicationInterviewError('application_interview_meeting_not_manageable', 409);
    }

    const meeting = await tx.meeting.findUnique({
      where: { id: lockedMeeting.id },
      include: interviewMeetingInclude,
    });
    if (!meeting) throw new ApplicationInterviewError('application_interview_not_found', 404);

    const interviewers = await activeInterviewers(tx, schedule.interviewerProfileIds);
    const host = interviewers[0];
    const selected = new Set(interviewers.map((staff) => staff.id));
    const existingInternal = meeting.participants.filter(
      (participant) => participant.participantType === 'INTERNAL_STAFF',
    );

    for (const participant of existingInternal) {
      if (!participant.staffProfileId || !selected.has(participant.staffProfileId)) {
        await tx.meetingParticipant.update({
          where: { id: participant.id },
          data: { state: 'REMOVED', removedAt: now },
        });
        continue;
      }

      const index = interviewers.findIndex((staff) => staff.id === participant.staffProfileId);
      await tx.meetingParticipant.update({
        where: { id: participant.id },
        data: {
          role: index === 0 ? 'HOST' : 'COHOST',
          state: 'ACCEPTED',
          acceptedAt: participant.acceptedAt || now,
          declinedAt: null,
          removedAt: null,
        },
      });
    }

    const existingIds = new Set(
      existingInternal.map((participant) => participant.staffProfileId).filter(Boolean),
    );
    for (let index = 0; index < interviewers.length; index += 1) {
      const staff = interviewers[index];
      if (existingIds.has(staff.id)) continue;
      await tx.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          participantType: 'INTERNAL_STAFF',
          staffProfileId: staff.id,
          emailNormalized: normaliseMeetingEmail(staff.email),
          displayName: staff.name || staff.email,
          role: index === 0 ? 'HOST' : 'COHOST',
          state: 'ACCEPTED',
          acceptedAt: now,
        },
      });
    }

    const interviewee = meeting.participants.find(
      (participant) => participant.participantType === 'EXTERNAL_GUEST' && participant.role === 'INTERVIEWEE',
    );
    if (!interviewee) {
      throw new ApplicationInterviewError('application_interview_interviewee_missing', 409);
    }

    const updatedMeeting = await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        title: schedule.title || meeting.title,
        agenda: schedule.agenda,
        timezone: schedule.timezone,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        durationMinutes: schedule.durationMinutes,
        hostProfileId: host.id,
        state: 'SCHEDULED',
      },
    });

    const fresh = await freshInvitationInTransaction({
      tx,
      meeting: updatedMeeting,
      participant: interviewee,
      subjectOverride: `Interview rescheduled — ${application.referenceCode}`,
      messageOverride: schedule.applicantMessage,
      preserveAcceptedState: currentStatus === 'INTERVIEW_SCHEDULED',
    });

    await tx.application.update({
      where: { id: application.id },
      data: { lastReviewedAt: now },
    });

    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'admin-dashboard',
        action: 'application.interview.rescheduled',
        entityType: 'Application',
        entityId: application.id,
        meta: {
          meetingId: meeting.id,
          status: currentStatus,
          startsAt: schedule.startsAt.toISOString(),
          interviewerProfileIds: interviewers.map((staff) => staff.id),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'api-gateway',
        action: 'meeting.rescheduled.application_interview',
        entityType: 'Meeting',
        entityId: meeting.id,
        meta: { applicationId: application.id },
      },
    });

    return {
      application,
      meeting: updatedMeeting,
      interviewers,
      interviewee,
      invitation: fresh.invitation,
      token: fresh.token,
      email: fresh.email,
      applicantMessage: schedule.applicantMessage,
    };
  });

  const emailDelivery = await deliverInterviewInvitation({
    meeting: updated.meeting,
    invitationId: updated.invitation.id,
    token: updated.token,
    email: updated.email,
    applicantMessage: updated.applicantMessage,
    subjectOverride: `Interview rescheduled — ${updated.application.referenceCode}`,
  }).catch((error: any) => ({ ok: false, error: String(error?.message || error) }));

  await deliverPanelNotification({
    eventKind: 'application.interview.panel_rescheduled',
    applicationId: updated.application.id,
    referenceCode: updated.application.referenceCode,
    opportunityTitle: updated.application.opportunity.title,
    meetingId: updated.meeting.id,
    startsAt: updated.meeting.startsAt,
    timezone: updated.meeting.timezone,
    recipients: updated.interviewers,
    action: 'rescheduled',
    applicantEmail: updated.application.applicantEmailNormalized,
  }).catch(() => null);

  return {
    application: {
      id: updated.application.id,
      referenceCode: updated.application.referenceCode,
      applicantEmailNormalized: updated.application.applicantEmailNormalized,
      opportunityTitle: updated.application.opportunity.title,
    },
    meetingId: updated.meeting.id,
    emailDelivery,
  };
}

export async function cancelApplicationInterview(input: {
  applicationId: string;
  actor: InterviewActor;
  reason: unknown;
  applicantMessage?: unknown;
}) {
  const reason = cleanApplicationInterviewText(input.reason, 1000);
  const applicantMessage = cleanApplicationInterviewText(input.applicantMessage, 2000) || null;
  if (!reason) {
    throw new ApplicationInterviewError('application_interview_cancel_reason_required', 400);
  }
  const now = new Date();

  const cancelled = await prisma.$transaction(async (tx) => {
    const lockedApplication = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `);
    const current = lockedApplication[0];
    if (!current) throw new ApplicationInterviewError('application_not_found', 404);
    const currentStatus = manageableApplicationInterviewStatus(current.status);
    if (!currentStatus || !canManageApplicationInterview(currentStatus)) {
      throw new ApplicationInterviewError('application_interview_cancel_not_available', 409);
    }

    const application = await tx.application.findUnique({
      where: { id: current.id },
      include: { opportunity: { select: { title: true } } },
    });
    if (!application) throw new ApplicationInterviewError('application_not_found', 404);

    const meetings = await tx.$queryRaw<Array<{ id: string; state: string }>>(Prisma.sql`
      SELECT "id", "state"::text AS "state"
      FROM "Meeting"
      WHERE "kind"::text = 'INTERVIEW'
        AND "contextType" = ${APPLICATION_INTERVIEW_CONTEXT_TYPE}
        AND "contextId" = ${application.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE
    `);
    const lockedMeeting = meetings[0];
    if (!lockedMeeting) throw new ApplicationInterviewError('application_interview_not_found', 404);
    if (!canCancelApplicationInterview({
      applicationStatus: currentStatus,
      meetingState: lockedMeeting.state,
    })) {
      throw new ApplicationInterviewError('application_interview_cancel_not_available', 409);
    }

    const meeting = await tx.meeting.findUnique({
      where: { id: lockedMeeting.id },
      include: interviewMeetingInclude,
    });
    if (!meeting) throw new ApplicationInterviewError('application_interview_not_found', 404);

    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        state: 'CANCELLED',
        cancelledAt: now,
        cancelledByProfileId: input.actor.actorType === 'ADMIN' ? input.actor.actorRefId : null,
        cancellationReason: reason,
        lockedAt: now,
      },
    });

    const invitationIds = meeting.invitations.map((item) => item.id);
    if (invitationIds.length) {
      await tx.meetingInvitation.updateMany({
        where: { id: { in: invitationIds }, revokedAt: null },
        data: { state: 'REVOKED', revokedAt: now },
      });
      await tx.meetingGuestSession.updateMany({
        where: { invitationId: { in: invitationIds }, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    await tx.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, state: { not: 'REMOVED' } },
      data: { state: 'REMOVED', removedAt: now },
    });

    const moved = await tx.application.updateMany({
      where: { id: application.id, status: currentStatus },
      data: {
        status: 'SHORTLISTED',
        statusReason: reason,
        statusChangedAt: now,
        lastReviewedAt: now,
      },
    });
    if (moved.count !== 1) {
      throw new ApplicationInterviewError('application_interview_state_conflict', 409);
    }

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: currentStatus,
        toStatus: 'SHORTLISTED',
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        reason,
        metadata: {
          source: 'application_interview',
          meetingId: meeting.id,
          action: 'cancelled',
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'admin-dashboard',
        action: 'application.interview.cancelled',
        entityType: 'Application',
        entityId: application.id,
        meta: { meetingId: meeting.id, from: currentStatus, to: 'SHORTLISTED' },
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'api-gateway',
        action: 'meeting.cancelled.application_interview',
        entityType: 'Meeting',
        entityId: meeting.id,
        meta: { applicationId: application.id },
      },
    });

    return { application, meeting, currentStatus, applicantMessage };
  });

  const applicantEmail = normaliseMeetingEmail(cancelled.application.applicantEmailNormalized);
  if (validMeetingEmail(applicantEmail)) {
    const subject = `Interview update — ${cancelled.application.referenceCode}`;
    const message = cancelled.applicantMessage || 'Your scheduled interview has been cancelled. Your application remains under consideration and has returned to the shortlist stage.';
    const text = [
      'Ambulant+ application interview update',
      '',
      `Reference: ${cancelled.application.referenceCode}`,
      `Opportunity: ${cancelled.application.opportunity.title}`,
      '',
      message,
    ].join('\n');
    const html = `<p><strong>${escapeHtml(cancelled.application.referenceCode)}</strong></p><p>${escapeHtml(message)}</p>`;
    const outbox = await prisma.notificationOutbox.create({
      data: {
        eventKind: 'application.interview.cancelled',
        recipientEmail: applicantEmail,
        channel: 'EMAIL',
        payload: {
          applicationId: cancelled.application.id,
          referenceCode: cancelled.application.referenceCode,
          meetingId: cancelled.meeting.id,
        },
      },
    });
    const sent = await sendEmail(applicantEmail, subject, html, text);
    await prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: sent.ok
        ? { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
        : { status: 'FAILED', attempts: { increment: 1 }, lastError: cleanApplicationInterviewText(sent.error, 1000) || 'email_delivery_failed' },
    });
  }

  const panel = (cancelled.meeting.participants || [])
    .filter((participant: any) => participant.participantType === 'INTERNAL_STAFF' && participant.staffProfile)
    .map((participant: any) => participant.staffProfile);
  await deliverPanelNotification({
    eventKind: 'application.interview.panel_cancelled',
    applicationId: cancelled.application.id,
    referenceCode: cancelled.application.referenceCode,
    opportunityTitle: cancelled.application.opportunity.title,
    meetingId: cancelled.meeting.id,
    startsAt: cancelled.meeting.startsAt,
    timezone: cancelled.meeting.timezone,
    recipients: panel,
    action: 'cancelled',
    applicantEmail: cancelled.application.applicantEmailNormalized,
  }).catch(() => null);

  return { ok: true, status: 'SHORTLISTED' as const };
}

export async function resendApplicationInterviewInvitation(input: {
  applicationId: string;
  actor: InterviewActor;
}) {
  const refreshed = await prisma.$transaction(async (tx) => {
    const lockedApplication = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `);
    const current = lockedApplication[0];
    if (!current) throw new ApplicationInterviewError('application_not_found', 404);

    const application = await tx.application.findUnique({
      where: { id: current.id },
      include: { opportunity: { select: { title: true } } },
    });
    if (!application) throw new ApplicationInterviewError('application_not_found', 404);

    const meetings = await tx.$queryRaw<Array<{ id: string; state: string }>>(Prisma.sql`
      SELECT "id", "state"::text AS "state"
      FROM "Meeting"
      WHERE "kind"::text = 'INTERVIEW'
        AND "contextType" = ${APPLICATION_INTERVIEW_CONTEXT_TYPE}
        AND "contextId" = ${application.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE
    `);
    const lockedMeeting = meetings[0];
    if (!lockedMeeting) throw new ApplicationInterviewError('application_interview_not_found', 404);
    if (!canResendApplicationInterviewInvitation({
      applicationStatus: current.status,
      meetingState: lockedMeeting.state,
    })) {
      throw new ApplicationInterviewError('application_interview_resend_not_available', 409);
    }

    const meeting = await tx.meeting.findUnique({
      where: { id: lockedMeeting.id },
      include: interviewMeetingInclude,
    });
    if (!meeting) throw new ApplicationInterviewError('application_interview_not_found', 404);

    const interviewee = meeting.participants.find(
      (participant) => participant.participantType === 'EXTERNAL_GUEST' && participant.role === 'INTERVIEWEE',
    );
    if (!interviewee) throw new ApplicationInterviewError('application_interview_interviewee_missing', 409);

    const fresh = await freshInvitationInTransaction({
      tx,
      meeting,
      participant: interviewee,
      subjectOverride: `Interview invitation — ${application.referenceCode}`,
      preserveAcceptedState: current.status === 'INTERVIEW_SCHEDULED',
    });

    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: input.actor.actorType === 'EXTERNAL_GUEST' ? 'landing' : 'admin-dashboard',
        action: 'application.interview.invitation_resent',
        entityType: 'Application',
        entityId: application.id,
        meta: { meetingId: meeting.id, invitationId: fresh.invitation.id },
      },
    });

    return { application, meeting, invitation: fresh.invitation, token: fresh.token, email: fresh.email };
  });

  const emailDelivery = await deliverInterviewInvitation({
    meeting: refreshed.meeting,
    invitationId: refreshed.invitation.id,
    token: refreshed.token,
    email: refreshed.email,
    subjectOverride: `Interview invitation — ${refreshed.application.referenceCode}`,
  }).catch((error: any) => ({ ok: false, error: String(error?.message || error) }));

  return { ok: true, meetingId: refreshed.meeting.id, emailDelivery };
}

export async function respondToApplicationInterview(input: {
  applicationId: string;
  actor: InterviewActor;
  response: unknown;
}) {
  const response = cleanApplicationInterviewText(input.response, 40).toUpperCase();
  if (response !== 'ACCEPT' && response !== 'DECLINE') {
    throw new ApplicationInterviewError('application_interview_response_invalid', 400);
  }
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const lockedApplication = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `);
    const current = lockedApplication[0];
    if (!current) throw new ApplicationInterviewError('application_not_found', 404);

    const application = await tx.application.findUnique({
      where: { id: current.id },
      include: { opportunity: { select: { title: true } } },
    });
    if (!application) throw new ApplicationInterviewError('application_not_found', 404);

    const meetings = await tx.$queryRaw<Array<{ id: string; state: string }>>(Prisma.sql`
      SELECT "id", "state"::text AS "state"
      FROM "Meeting"
      WHERE "kind"::text = 'INTERVIEW'
        AND "contextType" = ${APPLICATION_INTERVIEW_CONTEXT_TYPE}
        AND "contextId" = ${application.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE
    `);
    const lockedMeeting = meetings[0];
    if (!lockedMeeting) throw new ApplicationInterviewError('application_interview_not_found', 404);

    const meeting = await tx.meeting.findUnique({
      where: { id: lockedMeeting.id },
      include: interviewMeetingInclude,
    });
    if (!meeting) throw new ApplicationInterviewError('application_interview_not_found', 404);

    const interviewee = meeting.participants.find(
      (participant) => participant.participantType === 'EXTERNAL_GUEST' && participant.role === 'INTERVIEWEE',
    );
    if (!interviewee) throw new ApplicationInterviewError('application_interview_interviewee_missing', 409);

    if (!canApplicantRespondToApplicationInterview({
      applicationStatus: current.status,
      participantState: interviewee.state,
      meetingState: meeting.state,
    })) {
      throw new ApplicationInterviewError('application_interview_response_not_available', 409);
    }

    if (response === 'ACCEPT') {
      await tx.meetingParticipant.update({
        where: { id: interviewee.id },
        data: { state: 'ACCEPTED', acceptedAt: now, declinedAt: null },
      });

      const moved = await tx.application.updateMany({
        where: { id: application.id, status: 'INTERVIEW_INVITED' },
        data: {
          status: 'INTERVIEW_SCHEDULED',
          statusReason: null,
          statusChangedAt: now,
        },
      });
      if (moved.count !== 1) {
        throw new ApplicationInterviewError('application_interview_state_conflict', 409);
      }

      await tx.applicationStatusEvent.create({
        data: {
          applicationId: application.id,
          fromStatus: 'INTERVIEW_INVITED',
          toStatus: 'INTERVIEW_SCHEDULED',
          actorType: input.actor.actorType,
          actorRefId: input.actor.actorRefId,
          metadata: { source: 'application_interview', meetingId: meeting.id, response: 'ACCEPT' },
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: input.actor.actorType,
          actorRefId: input.actor.actorRefId,
          actorUserId: input.actor.actorUserId || null,
          app: 'landing',
          action: 'application.interview.accepted',
          entityType: 'Application',
          entityId: application.id,
          meta: { meetingId: meeting.id },
        },
      });

      return { application, meeting, interviewee, response, status: 'INTERVIEW_SCHEDULED' as const };
    }

    await tx.meetingParticipant.update({
      where: { id: interviewee.id },
      data: { state: 'DECLINED', declinedAt: now },
    });
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        state: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: 'Applicant declined interview invitation',
        lockedAt: now,
      },
    });

    const invitationIds = meeting.invitations.map((item) => item.id);
    if (invitationIds.length) {
      await tx.meetingInvitation.updateMany({
        where: { id: { in: invitationIds }, revokedAt: null },
        data: { state: 'REVOKED', revokedAt: now },
      });
      await tx.meetingGuestSession.updateMany({
        where: { invitationId: { in: invitationIds }, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    const moved = await tx.application.updateMany({
      where: { id: application.id, status: 'INTERVIEW_INVITED' },
      data: {
        status: 'SHORTLISTED',
        statusReason: null,
        statusChangedAt: now,
      },
    });
    if (moved.count !== 1) {
      throw new ApplicationInterviewError('application_interview_state_conflict', 409);
    }

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: 'INTERVIEW_INVITED',
        toStatus: 'SHORTLISTED',
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        metadata: { source: 'application_interview', meetingId: meeting.id, response: 'DECLINE' },
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: input.actor.actorType,
        actorRefId: input.actor.actorRefId,
        actorUserId: input.actor.actorUserId || null,
        app: 'landing',
        action: 'application.interview.declined',
        entityType: 'Application',
        entityId: application.id,
        meta: { meetingId: meeting.id, to: 'SHORTLISTED' },
      },
    });

    return { application, meeting, interviewee, response, status: 'SHORTLISTED' as const };
  });

  const panel = (result.meeting.participants || [])
    .filter((participant: any) => participant.participantType === 'INTERNAL_STAFF' && participant.staffProfile)
    .map((participant: any) => participant.staffProfile);

  await deliverPanelNotification({
    eventKind: result.response === 'ACCEPT'
      ? 'application.interview.panel_applicant_accepted'
      : 'application.interview.panel_applicant_declined',
    applicationId: result.application.id,
    referenceCode: result.application.referenceCode,
    opportunityTitle: result.application.opportunity.title,
    meetingId: result.meeting.id,
    startsAt: result.meeting.startsAt,
    timezone: result.meeting.timezone,
    recipients: panel,
    action: result.response === 'ACCEPT' ? 'accepted' : 'declined',
    applicantEmail: result.application.applicantEmailNormalized,
  }).catch(() => null);

  return { ok: true, status: result.status };
}

export function applicationInterviewResponse(error: unknown) {
  if (error instanceof ApplicationInterviewError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  return null;
}
