import { prisma } from '@/lib/prisma';
import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';
import {
  cleanMeetingText,
  mintMeetingRtcAccess,
  randomOpaqueToken,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';
import { normaliseMeetingEmail } from '@/src/lib/admin-meetings-policy';
import { canonicalDirectConversationKey, normalizeStaffMessageBody, validConversationShape, validDirectCallMode } from './enterprise-completion-policy';
import {
  createStaffNotification,
  listStaffNotifications,
  markStaffNotifications,
} from '@/src/lib/staff-notifications';

export class CommunicationsError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status = 400, detail?: unknown) {
    super(message);
    this.name = 'CommunicationsError';
    this.status = status;
    this.detail = detail;
  }
}

export function communicationsErrorResponse(error: unknown) {
  if (error instanceof CommunicationsError || error instanceof AdminStaffAuthError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: error.message,
        ...(error instanceof CommunicationsError && error.detail !== undefined
          ? { detail: error.detail }
          : {}),
      },
    };
  }
  return null;
}

function requireCommunications(actor: AdminStaffActor) {
  if (!hasStaffCapability(actor, 'communications.use')) {
    throw new AdminStaffAuthError('staff_capability_required', 403);
  }
  return actor;
}

function cleanText(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function uniqueIds(value: unknown, max = 100) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return Array.from(
    new Set(values.map((item) => cleanText(item, 160)).filter(Boolean) as string[]),
  ).slice(0, max);
}

const conversationInclude = {
  members: {
    where: { leftAt: null },
    orderBy: { joinedAt: 'asc' as const },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          email: true,
          photoUrl: true,
          lifecycleState: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          presence: true,
        },
      },
    },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: {
      senderProfile: { select: { id: true, name: true, email: true } },
    },
  },
};

const CALL_RING_SECONDS = 45;

function directCallMode(meeting: any) {
  return meeting?.allowVideo ? 'VIDEO' : 'AUDIO';
}

function directCallParticipant(meeting: any, profileId: string) {
  return (meeting?.participants || []).find(
    (participant: any) => participant.staffProfileId === profileId,
  ) || null;
}

function directCallOtherProfile(meeting: any, profileId: string) {
  return (meeting?.participants || []).find(
    (participant: any) => participant.staffProfileId && participant.staffProfileId !== profileId,
  )?.staffProfile || null;
}

function directCallSummary(meeting: any, actorProfileId: string) {
  return {
    id: meeting.id,
    state: meeting.state,
    outcome: meeting.callOutcome || null,
    endedReason: meeting.callEndedReason || null,
    mode: directCallMode(meeting),
    conversationId: meeting.contextId || null,
    createdAt: meeting.createdAt,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    ringExpiresAt: meeting.ringExpiresAt,
    callerProfileId: meeting.hostProfileId,
    isCaller: meeting.hostProfileId === actorProfileId,
    participant: directCallParticipant(meeting, actorProfileId),
    other: directCallOtherProfile(meeting, actorProfileId),
  };
}

const directCallInclude = {
  participants: {
    include: {
      staffProfile: {
        select: { id: true, name: true, email: true, photoUrl: true },
      },
    },
  },
} as const;

async function expireDirectCallsForProfile(profileId: string) {
  const now = new Date();
  const stale = await prisma.meeting.findMany({
    where: {
      kind: 'DIRECT_CALL',
      state: 'RINGING',
      ringExpiresAt: { lte: now },
      participants: {
        some: { staffProfileId: profileId },
      },
    },
    include: directCallInclude,
  });

  for (const meeting of stale) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.meeting.updateMany({
        where: { id: meeting.id, state: 'RINGING' },
        data: {
          state: 'ENDED',
          endedAt: now,
          callOutcome: 'MISSED',
          callEndedReason: 'No answer',
        },
      });
      if (!changed.count) return;

      await tx.meetingParticipant.updateMany({
        where: {
          meetingId: meeting.id,
          state: { in: ['INVITED', 'ACCEPTED', 'JOINED'] },
        },
        data: { state: 'LEFT', lastLeftAt: now },
      });

      const caller = meeting.participants.find(
        (participant) => participant.staffProfileId === meeting.hostProfileId,
      )?.staffProfile;
      const recipient = meeting.participants.find(
        (participant) => participant.staffProfileId !== meeting.hostProfileId,
      )?.staffProfile;

      if (recipient?.id) {
        await createStaffNotification(tx as any, {
          recipientProfileId: recipient.id,
          actorProfileId: caller?.id || null,
          conversationId: meeting.contextId,
          meetingId: meeting.id,
          type: 'MISSED_CALL',
          title: `Missed ${meeting.allowVideo ? 'video' : 'audio'} call`,
          body: caller?.name || caller?.email || 'A colleague called you.',
          payload: { mode: directCallMode(meeting) },
          dedupeKey: `missed-call:${meeting.id}:${recipient.id}`,
        });
      }
      if (caller?.id) {
        await createStaffNotification(tx as any, {
          recipientProfileId: caller.id,
          actorProfileId: recipient?.id || null,
          conversationId: meeting.contextId,
          meetingId: meeting.id,
          type: 'CALL_NO_ANSWER',
          title: 'No answer',
          body: recipient?.name || recipient?.email || 'The call was not answered.',
          payload: { mode: directCallMode(meeting) },
          dedupeKey: `no-answer:${meeting.id}:${caller.id}`,
        });
      }
    });
  }
}

async function activeDirectCallForProfile(profileId: string, excludeId?: string) {
  return prisma.meeting.findFirst({
    where: {
      kind: 'DIRECT_CALL',
      id: excludeId ? { not: excludeId } : undefined,
      state: { in: ['RINGING', 'LIVE'] },
      participants: {
        some: {
          staffProfileId: profileId,
          state: { in: ['INVITED', 'ACCEPTED', 'JOINED'] },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: directCallInclude,
  });
}

async function requireConversationMember(conversationId: string, actor: AdminStaffActor) {
  requireCommunications(actor);
  const member = await prisma.staffConversationMember.findUnique({
    where: {
      conversationId_profileId: {
        conversationId,
        profileId: actor.profileId,
      },
    },
    include: { conversation: true },
  });

  if (!member || member.leftAt) {
    throw new CommunicationsError('conversation_access_denied', 403);
  }

  return member;
}

export async function listStaffConversations(actor: AdminStaffActor) {
  requireCommunications(actor);
  await expireDirectCallsForProfile(actor.profileId);

  const [conversations, incomingCalls] = await Promise.all([
    prisma.staffConversation.findMany({
      where: {
        members: {
          some: { profileId: actor.profileId, leftAt: null },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      include: conversationInclude,
    }),
    prisma.meeting.findMany({
      where: {
        kind: 'DIRECT_CALL',
        state: 'RINGING',
        OR: [{ ringExpiresAt: null }, { ringExpiresAt: { gt: new Date() } }],
        participants: {
          some: {
            staffProfileId: actor.profileId,
            state: 'INVITED',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: directCallInclude,
    }),
  ]);

  return {
    ok: true,
    actorProfileId: actor.profileId,
    incomingCalls: incomingCalls.map((meeting) => directCallSummary(meeting, actor.profileId)),
    conversations: conversations.map((conversation) => {
      const latestMessage = conversation.messages[0] || null;
      const membership = conversation.members.find(
        (member) => member.profileId === actor.profileId,
      );
      const unreadCount = Math.max(0, Number((membership as any)?.unreadCount || 0));
      return {
        ...conversation,
        latestMessage,
        unread: unreadCount > 0,
        unreadCount,
        messages: undefined,
      };
    }),
  };
}

export async function createStaffConversation(input: {
  actor: AdminStaffActor;
  body: any;
}) {
  requireCommunications(input.actor);

  const kind = cleanText(input.body?.kind, 40)?.toUpperCase() || 'DIRECT';
  const profileIds = uniqueIds(input.body?.profileIds, 50).filter(
    (id) => id !== input.actor.profileId,
  );

  if (!['DIRECT', 'GROUP'].includes(kind)) {
    throw new CommunicationsError('invalid_conversation_kind', 400);
  }

  const title = cleanText(input.body?.title, 240);
  if (!validConversationShape({ kind, otherProfileIds: profileIds, title })) {
    throw new CommunicationsError(
      kind === 'DIRECT'
        ? 'direct_conversation_requires_one_other_staff_member'
        : 'group_conversation_requires_members_and_title',
      400,
    );
  }

  const staff = await prisma.adminUserProfile.findMany({
    where: {
      id: { in: profileIds },
      lifecycleState: { in: ['ACTIVE', 'LEAVE'] },
    },
    select: { id: true, name: true, email: true },
  });

  if (staff.length !== profileIds.length) {
    throw new CommunicationsError('conversation_staff_member_invalid', 409);
  }

  if (kind === 'DIRECT') {
    const key = canonicalDirectConversationKey(input.actor.profileId, profileIds[0]);
    if (!key) {
      throw new CommunicationsError('invalid_direct_conversation_participants', 400);
    }
    const existing = await prisma.staffConversation.findUnique({
      where: { directKey: key },
      include: conversationInclude,
    });
    if (existing) {
      await prisma.staffConversationMember.updateMany({
        where: {
          conversationId: existing.id,
          profileId: { in: [input.actor.profileId, profileIds[0]] },
        },
        data: { leftAt: null },
      });
      return { ok: true, conversation: existing, reused: true };
    }
  }

  const conversation = await prisma.staffConversation.create({
    data: {
      kind: kind as any,
      title: kind === 'GROUP' ? title : null,
      directKey: kind === 'DIRECT'
        ? canonicalDirectConversationKey(input.actor.profileId, profileIds[0])
        : null,
      createdByProfileId: input.actor.profileId,
      members: {
        create: [
          {
            profileId: input.actor.profileId,
            role: 'OWNER',
            lastReadAt: new Date(),
          },
          ...profileIds.map((profileId) => ({
            profileId,
            role: 'MEMBER' as const,
          })),
        ],
      },
    },
    include: conversationInclude,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'communications.conversation.created',
      entityType: 'StaffConversation',
      entityId: conversation.id,
      description: conversation.title || 'Direct staff conversation',
      meta: { kind, memberProfileIds: profileIds },
    },
  }).catch(() => null);

  return { ok: true, conversation, reused: false };
}

export async function getStaffConversation(input: {
  actor: AdminStaffActor;
  conversationId: string;
  before?: string | null;
}) {
  await requireConversationMember(input.conversationId, input.actor);

  const before = input.before ? new Date(input.before) : null;
  const validBefore = before && Number.isFinite(before.getTime()) ? before : null;

  const [conversation, messages] = await Promise.all([
    prisma.staffConversation.findUnique({
      where: { id: input.conversationId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                email: true,
                photoUrl: true,
                lifecycleState: true,
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                presence: true,
              },
            },
          },
        },
      },
    }),
    prisma.staffMessage.findMany({
      where: {
        conversationId: input.conversationId,
        deletedAt: null,
        ...(validBefore ? { createdAt: { lt: validBefore } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        senderProfile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
    }),
  ]);

  if (!conversation) throw new CommunicationsError('conversation_not_found', 404);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.staffConversationMember.update({
      where: {
        conversationId_profileId: {
          conversationId: input.conversationId,
          profileId: input.actor.profileId,
        },
      },
      data: { lastReadAt: now, unreadCount: 0 },
    });
    await tx.staffNotification.updateMany({
      where: {
        recipientProfileId: input.actor.profileId,
        conversationId: input.conversationId,
        type: 'MESSAGE',
        readAt: null,
      },
      data: { readAt: now },
    });
  });

  return {
    ok: true,
    actorProfileId: input.actor.profileId,
    conversation,
    messages: messages.reverse(),
    nextBefore: messages.length === 100 ? messages[0]?.createdAt || null : null,
  };
}

export async function postStaffMessage(input: {
  actor: AdminStaffActor;
  conversationId: string;
  body: any;
}) {
  await requireConversationMember(input.conversationId, input.actor);
  const body = normalizeStaffMessageBody(input.body?.body, 8000);
  if (!body) throw new CommunicationsError('message_body_required', 400);

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const members = await tx.staffConversationMember.findMany({
      where: { conversationId: input.conversationId, leftAt: null },
      include: {
        profile: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const created = await tx.staffMessage.create({
      data: {
        conversationId: input.conversationId,
        senderProfileId: input.actor.profileId,
        body,
      },
      include: {
        senderProfile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
    });

    await tx.staffConversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: now },
    });

    await tx.staffConversationMember.update({
      where: {
        conversationId_profileId: {
          conversationId: input.conversationId,
          profileId: input.actor.profileId,
        },
      },
      data: { lastReadAt: now, unreadCount: 0 },
    });

    const recipients = members.filter(
      (member) => member.profileId !== input.actor.profileId,
    );

    for (const recipient of recipients) {
      await tx.staffConversationMember.update({
        where: {
          conversationId_profileId: {
            conversationId: input.conversationId,
            profileId: recipient.profileId,
          },
        },
        data: { unreadCount: { increment: 1 } },
      });

      await createStaffNotification(tx as any, {
        recipientProfileId: recipient.profileId,
        actorProfileId: input.actor.profileId,
        conversationId: input.conversationId,
        type: 'MESSAGE',
        title: input.actor.name || input.actor.email,
        body: body.slice(0, 240),
        payload: { messageId: created.id },
      });
    }

    return created;
  });

  return { ok: true, message };
}

export async function updateStaffConversation(input: {
  actor: AdminStaffActor;
  conversationId: string;
  body: any;
}) {
  const membership = await requireConversationMember(input.conversationId, input.actor);
  const conversation = membership.conversation;
  if (conversation.kind !== 'GROUP') {
    throw new CommunicationsError('direct_conversation_membership_is_fixed', 409);
  }
  if (membership.role !== 'OWNER' && !input.actor.isSuperAdmin) {
    throw new CommunicationsError('conversation_owner_required', 403);
  }

  const title = cleanText(input.body?.title, 240) || conversation.title;
  const profileIds = uniqueIds(input.body?.profileIds, 50).filter(
    (id) => id !== input.actor.profileId,
  );
  if (!profileIds.length) throw new CommunicationsError('group_conversation_requires_members', 400);

  const staff = await prisma.adminUserProfile.findMany({
    where: {
      id: { in: profileIds },
      lifecycleState: { in: ['ACTIVE', 'LEAVE'] },
    },
    select: { id: true },
  });
  if (staff.length !== profileIds.length) {
    throw new CommunicationsError('conversation_staff_member_invalid', 409);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.staffConversation.update({
      where: { id: conversation.id },
      data: { title },
    });

    const existing = await tx.staffConversationMember.findMany({
      where: { conversationId: conversation.id },
      select: { profileId: true, role: true },
    });

    const wanted = new Set([input.actor.profileId, ...profileIds]);
    for (const member of existing) {
      if (member.profileId === input.actor.profileId) continue;
      if (!wanted.has(member.profileId)) {
        await tx.staffConversationMember.update({
          where: {
            conversationId_profileId: {
              conversationId: conversation.id,
              profileId: member.profileId,
            },
          },
          data: { leftAt: now },
        });
      }
    }

    for (const profileId of profileIds) {
      await tx.staffConversationMember.upsert({
        where: {
          conversationId_profileId: {
            conversationId: conversation.id,
            profileId,
          },
        },
        update: { leftAt: null },
        create: { conversationId: conversation.id, profileId, role: 'MEMBER' },
      });
    }
  });

  return getStaffConversation({ actor: input.actor, conversationId: conversation.id });
}

export async function startDirectStaffCall(input: {
  actor: AdminStaffActor;
  conversationId: string;
  mode: unknown;
  userAgent?: string | null;
}) {
  const membership = await requireConversationMember(input.conversationId, input.actor);
  const conversation = membership.conversation;
  if (conversation.kind !== 'DIRECT') {
    throw new CommunicationsError('direct_call_requires_direct_conversation', 409);
  }

  await expireDirectCallsForProfile(input.actor.profileId);

  const members = await prisma.staffConversationMember.findMany({
    where: { conversationId: conversation.id, leftAt: null },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          email: true,
          lifecycleState: true,
          presence: true,
        },
      },
    },
  });

  if (members.length !== 2) {
    throw new CommunicationsError('direct_conversation_member_shape_invalid', 409);
  }

  const target = members.find(
    (member) => member.profileId !== input.actor.profileId,
  )?.profile;

  if (!target || !['ACTIVE', 'LEAVE'].includes(target.lifecycleState)) {
    throw new CommunicationsError('direct_call_target_unavailable', 409);
  }

  const existingCallerCall = await activeDirectCallForProfile(input.actor.profileId);
  if (existingCallerCall) {
    const existingParticipant = directCallParticipant(
      existingCallerCall,
      input.actor.profileId,
    );

    const sameOutgoingConversation =
      existingCallerCall.hostProfileId === input.actor.profileId &&
      existingCallerCall.contextId === conversation.id &&
      existingParticipant &&
      ['ACCEPTED', 'JOINED'].includes(existingParticipant.state);

    if (!sameOutgoingConversation || !existingParticipant) {
      throw new CommunicationsError('direct_call_already_active', 409);
    }

    const rtc = await mintMeetingRtcAccess({
      meeting: existingCallerCall,
      participant: existingParticipant,
      identity: `meeting:${existingCallerCall.id}:staff:${input.actor.profileId}`,
      displayName: input.actor.name || input.actor.email,
    });

    return {
      ok: true,
      reused: true,
      call: directCallSummary(existingCallerCall, input.actor.profileId),
      rtc: { ...rtc, expiresInSeconds: 900 },
    };
  }

  const requestedMode = validDirectCallMode(
    cleanText(input.mode, 20)?.toLowerCase(),
  );
  if (!requestedMode) {
    throw new CommunicationsError('invalid_direct_call_mode', 400);
  }

  const mode = requestedMode === 'audio' ? 'AUDIO' : 'VIDEO';
  const now = new Date();
  const durationMinutes = 60;
  const targetBusy = Boolean(await activeDirectCallForProfile(target.id));

  const meeting = await prisma.$transaction(async (tx) => {
    const created = await tx.meeting.create({
      data: {
        roomId: `meeting-${randomOpaqueToken(18)}`,
        kind: 'DIRECT_CALL',
        state: targetBusy ? 'ENDED' : 'RINGING',
        title: `${mode === 'AUDIO' ? 'Audio' : 'Video'} call with ${target.name || target.email}`,
        timezone: 'Africa/Johannesburg',
        startsAt: now,
        endsAt: new Date(now.getTime() + durationMinutes * 60_000),
        durationMinutes,
        createdByProfileId: input.actor.profileId,
        hostProfileId: input.actor.profileId,
        contextType: 'STAFF_CONVERSATION',
        contextId: conversation.id,
        allowAudio: true,
        allowVideo: mode === 'VIDEO',
        allowChat: true,
        allowFiles: false,
        allowScreenShare: mode === 'VIDEO',
        allowRecording: false,
        lobbyRequired: false,
        ringExpiresAt: targetBusy
          ? null
          : new Date(now.getTime() + CALL_RING_SECONDS * 1000),
        ...(targetBusy
          ? {
              endedAt: now,
              callOutcome: 'BUSY' as const,
              callEndedReason: 'Recipient is already on another call',
            }
          : {}),
      },
    });

    await tx.meetingParticipant.createMany({
      data: [
        {
          meetingId: created.id,
          participantType: 'INTERNAL_STAFF',
          staffProfileId: input.actor.profileId,
          emailNormalized: normaliseMeetingEmail(input.actor.email),
          displayName: input.actor.name || input.actor.email,
          role: 'HOST',
          state: targetBusy ? 'LEFT' : 'JOINED',
          acceptedAt: now,
          firstJoinedAt: targetBusy ? null : now,
          lastLeftAt: targetBusy ? now : null,
        },
        {
          meetingId: created.id,
          participantType: 'INTERNAL_STAFF',
          staffProfileId: target.id,
          emailNormalized: normaliseMeetingEmail(target.email),
          displayName: target.name || target.email,
          role: 'ATTENDEE',
          state: targetBusy ? 'LEFT' : 'INVITED',
          lastLeftAt: targetBusy ? now : null,
        },
      ],
    });

    if (targetBusy) {
      await createStaffNotification(tx as any, {
        recipientProfileId: input.actor.profileId,
        actorProfileId: target.id,
        conversationId: conversation.id,
        meetingId: created.id,
        type: 'CALL_BUSY',
        title: 'Call could not connect',
        body: `${target.name || target.email} is already on another call.`,
        payload: { mode },
        dedupeKey: `call-busy:${created.id}:${input.actor.profileId}`,
      });
    } else {
      await createStaffNotification(tx as any, {
        recipientProfileId: target.id,
        actorProfileId: input.actor.profileId,
        conversationId: conversation.id,
        meetingId: created.id,
        type: 'INCOMING_CALL',
        title: `Incoming ${mode === 'VIDEO' ? 'video' : 'audio'} call`,
        body: input.actor.name || input.actor.email,
        payload: { mode, callerProfileId: input.actor.profileId },
        dedupeKey: `incoming-call:${created.id}:${target.id}`,
      });
    }

    return created;
  });

  const fullMeeting = await prisma.meeting.findUnique({
    where: { id: meeting.id },
    include: directCallInclude,
  });
  if (!fullMeeting) {
    throw new CommunicationsError('direct_call_creation_failed', 500);
  }

  if (targetBusy) {
    return {
      ok: true,
      reused: false,
      busy: true,
      call: directCallSummary(fullMeeting, input.actor.profileId),
      rtc: null,
    };
  }

  const callerParticipant = directCallParticipant(
    fullMeeting,
    input.actor.profileId,
  );
  if (!callerParticipant) {
    throw new CommunicationsError('direct_call_participant_missing', 500);
  }

  const rtc = await mintMeetingRtcAccess({
    meeting: fullMeeting,
    participant: callerParticipant,
    identity: `meeting:${fullMeeting.id}:staff:${input.actor.profileId}`,
    displayName: input.actor.name || input.actor.email,
  });

  await writeMeetingAudit({
    actorUserId: input.actor.userId,
    actorRefId: input.actor.profileId,
    action: 'meeting.direct_call.created',
    meetingId: fullMeeting.id,
    description: `${mode} staff call started`,
    userAgent: input.userAgent,
    meta: {
      conversationId: conversation.id,
      targetProfileId: target.id,
      mode,
      callerAutoJoined: true,
    },
  });

  return {
    ok: true,
    reused: false,
    busy: false,
    call: directCallSummary(fullMeeting, input.actor.profileId),
    rtc: { ...rtc, expiresInSeconds: 900 },
  };
}

export async function staffCommunicationsSummary(actor: AdminStaffActor) {
  requireCommunications(actor);
  await expireDirectCallsForProfile(actor.profileId);

  const now = new Date();
  const [memberships, incoming, currentCall, notifications, callHistory] = await Promise.all([
    prisma.staffConversationMember.findMany({
      where: { profileId: actor.profileId, leftAt: null },
      select: { unreadCount: true },
    }),
    prisma.meeting.findMany({
      where: {
        kind: 'DIRECT_CALL',
        state: 'RINGING',
        OR: [{ ringExpiresAt: null }, { ringExpiresAt: { gt: now } }],
        participants: {
          some: { staffProfileId: actor.profileId, state: 'INVITED' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: directCallInclude,
    }),
    prisma.meeting.findFirst({
      where: {
        kind: 'DIRECT_CALL',
        state: { in: ['RINGING', 'LIVE'] },
        participants: {
          some: {
            staffProfileId: actor.profileId,
            state: { in: ['INVITED', 'ACCEPTED', 'JOINED'] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: directCallInclude,
    }),
    listStaffNotifications(actor.profileId, 50),
    prisma.meeting.findMany({
      where: {
        kind: 'DIRECT_CALL',
        state: { in: ['ENDED', 'CANCELLED', 'EXPIRED'] },
        participants: { some: { staffProfileId: actor.profileId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: directCallInclude,
    }),
  ]);

  return {
    ok: true,
    actorProfileId: actor.profileId,
    unreadMessages: memberships.reduce(
      (sum, member) => sum + Math.max(0, Number((member as any).unreadCount || 0)),
      0,
    ),
    unreadNotifications: notifications.filter((item) => !item.readAt && item.type !== 'MESSAGE').length,
    incomingCalls: incoming.map((meeting) => directCallSummary(meeting, actor.profileId)),
    currentCall: currentCall ? directCallSummary(currentCall, actor.profileId) : null,
    activeCall:
      currentCall && currentCall.state === 'LIVE'
        ? directCallSummary(currentCall, actor.profileId)
        : null,
    notifications,
    callHistory: callHistory.map((meeting) => directCallSummary(meeting, actor.profileId)),
  };
}

export async function respondToDirectStaffCall(input: {
  actor: AdminStaffActor;
  meetingId: string;
  action: unknown;
  userAgent?: string | null;
}) {
  requireCommunications(input.actor);
  await expireDirectCallsForProfile(input.actor.profileId);

  const meeting = await prisma.meeting.findUnique({
    where: { id: input.meetingId },
    include: directCallInclude,
  });
  if (!meeting || meeting.kind !== 'DIRECT_CALL') {
    throw new CommunicationsError('direct_call_not_found', 404);
  }

  const participant = directCallParticipant(meeting, input.actor.profileId);
  if (!participant) throw new CommunicationsError('direct_call_access_denied', 403);
  if (participant.staffProfileId === meeting.hostProfileId) {
    throw new CommunicationsError('direct_call_recipient_required', 409);
  }

  const action = cleanText(input.action, 20)?.toUpperCase();
  if (!['ACCEPT', 'DECLINE'].includes(action || '')) {
    throw new CommunicationsError('direct_call_response_invalid', 400);
  }
  if (meeting.state !== 'RINGING') {
    throw new CommunicationsError('direct_call_no_longer_ringing', 409);
  }
  if (meeting.ringExpiresAt && meeting.ringExpiresAt.getTime() <= Date.now()) {
    await expireDirectCallsForProfile(input.actor.profileId);
    throw new CommunicationsError('direct_call_no_longer_ringing', 409);
  }

  const caller = directCallOtherProfile(meeting, input.actor.profileId);
  const now = new Date();

  if (action === 'DECLINE') {
    await prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          state: 'ENDED',
          endedAt: now,
          callOutcome: 'DECLINED',
          callEndedReason: 'Recipient declined the call',
        },
      });
      await tx.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, staffProfileId: input.actor.profileId },
        data: { state: 'DECLINED', declinedAt: now },
      });
      await tx.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, staffProfileId: meeting.hostProfileId },
        data: { state: 'LEFT', lastLeftAt: now },
      });
      await tx.staffNotification.updateMany({
        where: {
          recipientProfileId: input.actor.profileId,
          meetingId: meeting.id,
          type: 'INCOMING_CALL',
        },
        data: { readAt: now, dismissedAt: now },
      });
      await createStaffNotification(tx as any, {
        recipientProfileId: meeting.hostProfileId,
        actorProfileId: input.actor.profileId,
        conversationId: meeting.contextId,
        meetingId: meeting.id,
        type: 'CALL_DECLINED',
        title: 'Call declined',
        body: input.actor.name || input.actor.email,
        payload: { mode: directCallMode(meeting) },
        dedupeKey: `call-declined:${meeting.id}:${meeting.hostProfileId}`,
      });
    });

    return { ok: true, action: 'DECLINE', call: { ...directCallSummary(meeting, input.actor.profileId), state: 'ENDED', outcome: 'DECLINED' }, rtc: null };
  }

  const conflict = await activeDirectCallForProfile(input.actor.profileId, meeting.id);
  if (conflict) {
    throw new CommunicationsError('direct_call_target_busy', 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        state: 'LIVE',
        startedAt: meeting.startedAt || now,
        callOutcome: null,
        callEndedReason: null,
      },
    });
    await tx.meetingParticipant.update({
      where: { id: participant.id },
      data: {
        state: 'JOINED',
        acceptedAt: participant.acceptedAt || now,
        firstJoinedAt: participant.firstJoinedAt || now,
      },
    });
    await tx.staffNotification.updateMany({
      where: {
        recipientProfileId: input.actor.profileId,
        meetingId: meeting.id,
        type: 'INCOMING_CALL',
      },
      data: { readAt: now, dismissedAt: now },
    });
    await createStaffNotification(tx as any, {
      recipientProfileId: meeting.hostProfileId,
      actorProfileId: input.actor.profileId,
      conversationId: meeting.contextId,
      meetingId: meeting.id,
      type: 'CALL_ACCEPTED',
      title: 'Call connected',
      body: input.actor.name || input.actor.email,
      payload: { mode: directCallMode(meeting) },
      dedupeKey: `call-accepted:${meeting.id}:${meeting.hostProfileId}`,
    });
  });

  const acceptedMeeting = await prisma.meeting.findUnique({
    where: { id: meeting.id },
    include: directCallInclude,
  });
  if (!acceptedMeeting) throw new CommunicationsError('direct_call_not_found', 404);

  const acceptedParticipant = directCallParticipant(acceptedMeeting, input.actor.profileId);
  if (!acceptedParticipant) {
    throw new CommunicationsError('direct_call_participant_missing', 500);
  }
  const rtc = await mintMeetingRtcAccess({
    meeting: acceptedMeeting,
    participant: acceptedParticipant,
    identity: `meeting:${acceptedMeeting.id}:staff:${input.actor.profileId}`,
    displayName: input.actor.name || input.actor.email,
  });

  await writeMeetingAudit({
    actorUserId: input.actor.userId,
    actorRefId: input.actor.profileId,
    action: 'meeting.direct_call.accepted',
    meetingId: meeting.id,
    description: 'Direct staff call accepted',
    userAgent: input.userAgent,
    meta: { callerProfileId: caller?.id || meeting.hostProfileId },
  });

  return {
    ok: true,
    action: 'ACCEPT',
    call: directCallSummary(acceptedMeeting, input.actor.profileId),
    rtc: { ...rtc, expiresInSeconds: 900 },
  };
}

export async function endDirectStaffCall(input: {
  actor: AdminStaffActor;
  meetingId: string;
  reason?: unknown;
  userAgent?: string | null;
}) {
  requireCommunications(input.actor);

  const meeting = await prisma.meeting.findUnique({
    where: { id: input.meetingId },
    include: directCallInclude,
  });
  if (!meeting || meeting.kind !== 'DIRECT_CALL') {
    throw new CommunicationsError('direct_call_not_found', 404);
  }

  const participant = directCallParticipant(meeting, input.actor.profileId);
  if (!participant) throw new CommunicationsError('direct_call_access_denied', 403);

  if (['ENDED', 'CANCELLED', 'EXPIRED'].includes(meeting.state)) {
    return { ok: true, call: directCallSummary(meeting, input.actor.profileId) };
  }

  const now = new Date();
  const wasLive = meeting.state === 'LIVE';
  const reason = cleanText(input.reason, 240) || (wasLive ? 'Call ended' : 'Call cancelled');
  const other = directCallOtherProfile(meeting, input.actor.profileId);

  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        state: 'ENDED',
        endedAt: now,
        callOutcome: wasLive ? 'COMPLETED' : 'CANCELLED',
        callEndedReason: reason,
      },
    });
    await tx.meetingParticipant.updateMany({
      where: {
        meetingId: meeting.id,
        state: { in: ['INVITED', 'ACCEPTED', 'JOINED'] },
      },
      data: { state: 'LEFT', lastLeftAt: now },
    });
    await tx.staffNotification.updateMany({
      where: { meetingId: meeting.id, type: 'INCOMING_CALL' },
      data: { readAt: now, dismissedAt: now },
    });
    if (other?.id) {
      await createStaffNotification(tx as any, {
        recipientProfileId: other.id,
        actorProfileId: input.actor.profileId,
        conversationId: meeting.contextId,
        meetingId: meeting.id,
        type: 'CALL_ENDED',
        title: wasLive ? 'Call ended' : 'Call cancelled',
        body: input.actor.name || input.actor.email,
        payload: { mode: directCallMode(meeting), reason },
        dedupeKey: `call-ended:${meeting.id}:${other.id}`,
      });
    }
  });

  await writeMeetingAudit({
    actorUserId: input.actor.userId,
    actorRefId: input.actor.profileId,
    action: 'meeting.direct_call.ended',
    meetingId: meeting.id,
    description: reason,
    userAgent: input.userAgent,
    meta: { outcome: wasLive ? 'COMPLETED' : 'CANCELLED' },
  });

  return {
    ok: true,
    call: {
      ...directCallSummary(meeting, input.actor.profileId),
      state: 'ENDED',
      outcome: wasLive ? 'COMPLETED' : 'CANCELLED',
      endedAt: now,
    },
  };
}

export async function reconnectDirectStaffCall(input: {
  actor: AdminStaffActor;
  meetingId: string;
}) {
  requireCommunications(input.actor);

  const meeting = await prisma.meeting.findUnique({
    where: { id: input.meetingId },
    include: directCallInclude,
  });
  if (!meeting || meeting.kind !== 'DIRECT_CALL' || !['RINGING', 'LIVE'].includes(meeting.state)) {
    throw new CommunicationsError('direct_call_not_available', 409);
  }
  const participant = directCallParticipant(meeting, input.actor.profileId);
  if (!participant || ['REMOVED', 'DECLINED'].includes(participant.state)) {
    throw new CommunicationsError('direct_call_access_denied', 403);
  }

  const rtc = await mintMeetingRtcAccess({
    meeting,
    participant,
    identity: `meeting:${meeting.id}:staff:${input.actor.profileId}`,
    displayName: input.actor.name || input.actor.email,
  });

  return {
    ok: true,
    call: directCallSummary(meeting, input.actor.profileId),
    rtc: { ...rtc, expiresInSeconds: 900 },
  };
}

export async function updateStaffNotifications(input: {
  actor: AdminStaffActor;
  body: any;
}) {
  requireCommunications(input.actor);
  const result = await markStaffNotifications({
    profileId: input.actor.profileId,
    ids: Array.isArray(input.body?.ids) ? input.body.ids : [],
    read: input.body?.read === undefined ? undefined : Boolean(input.body.read),
    dismissed: input.body?.dismissed === undefined ? undefined : Boolean(input.body.dismissed),
  });
  return { ok: true, count: result.count };
}

