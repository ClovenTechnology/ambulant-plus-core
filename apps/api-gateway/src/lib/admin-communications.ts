import { prisma } from '@/lib/prisma';
import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';
import {
  cleanMeetingText,
  randomOpaqueToken,
  writeMeetingAudit,
} from '@/src/lib/admin-meetings';
import { normaliseMeetingEmail } from '@/src/lib/admin-meetings-policy';
import { canonicalDirectConversationKey, normalizeStaffMessageBody, validConversationShape, validDirectCallMode } from './enterprise-completion-policy';

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
        state: { in: ['RINGING', 'LIVE'] },
        participants: {
          some: {
            staffProfileId: actor.profileId,
            state: { in: ['INVITED', 'ACCEPTED'] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        participants: {
          include: {
            staffProfile: { select: { id: true, name: true, email: true, photoUrl: true } },
          },
        },
      },
    }),
  ]);

  return {
    ok: true,
    actorProfileId: actor.profileId,
    incomingCalls,
    conversations: conversations.map((conversation) => {
      const latestMessage = conversation.messages[0] || null;
      const membership = conversation.members.find((member) => member.profileId === actor.profileId);
      const unread = Boolean(
        latestMessage &&
        latestMessage.senderProfileId !== actor.profileId &&
        (!membership?.lastReadAt || latestMessage.createdAt > membership.lastReadAt),
      );
      return {
        ...conversation,
        latestMessage,
        unread,
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

  await prisma.staffConversationMember.update({
    where: {
      conversationId_profileId: {
        conversationId: input.conversationId,
        profileId: input.actor.profileId,
      },
    },
    data: { lastReadAt: new Date() },
  }).catch(() => null);

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
      data: { lastReadAt: now },
    });

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

  const members = await prisma.staffConversationMember.findMany({
    where: { conversationId: conversation.id, leftAt: null },
    include: {
      profile: {
        select: { id: true, name: true, email: true, lifecycleState: true },
      },
    },
  });
  if (members.length !== 2) {
    throw new CommunicationsError('direct_conversation_member_shape_invalid', 409);
  }

  const target = members.find((member) => member.profileId !== input.actor.profileId)?.profile;
  if (!target || !['ACTIVE', 'LEAVE'].includes(target.lifecycleState)) {
    throw new CommunicationsError('direct_call_target_unavailable', 409);
  }

  const requestedMode = validDirectCallMode(cleanText(input.mode, 20)?.toLowerCase());
  if (!requestedMode) throw new CommunicationsError('invalid_direct_call_mode', 400);
  const mode = requestedMode === 'audio' ? 'AUDIO' : 'VIDEO';
  const now = new Date();
  const durationMinutes = 60;
  const meeting = await prisma.$transaction(async (tx) => {
    const created = await tx.meeting.create({
      data: {
        roomId: `meeting-${randomOpaqueToken(18)}`,
        kind: 'DIRECT_CALL',
        state: 'RINGING',
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
          state: 'ACCEPTED',
          acceptedAt: now,
        },
        {
          meetingId: created.id,
          participantType: 'INTERNAL_STAFF',
          staffProfileId: target.id,
          emailNormalized: normaliseMeetingEmail(target.email),
          displayName: target.name || target.email,
          role: 'ATTENDEE',
          state: 'INVITED',
        },
      ],
    });

    return created;
  });

  await writeMeetingAudit({
    actorUserId: input.actor.userId,
    actorRefId: input.actor.profileId,
    action: 'meeting.direct_call.created',
    meetingId: meeting.id,
    description: `${mode} direct staff call created`,
    userAgent: input.userAgent,
    meta: {
      conversationId: conversation.id,
      targetProfileId: target.id,
      mode,
    },
  });

  return { ok: true, meeting, target, mode };
}
