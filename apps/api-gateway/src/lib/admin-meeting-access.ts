import { prisma } from '@/lib/prisma';
import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';

export async function meetingForActor(
  meetingId: string,
  actor: AdminStaffActor,
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: {
        include: {
          staffProfile: {
            select: {
              id: true,
              userId: true,
              email: true,
              name: true,
              lifecycleState: true,
              presence: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { invitedAt: 'asc' }],
      },
      invitations: {
        select: {
          id: true,
          participantId: true,
          emailNormalized: true,
          state: true,
          expiresAt: true,
          verifiedAt: true,
          revokedAt: true,
          lastUsedAt: true,
          attemptCount: true,
          lockedUntil: true,
          subjectOverride: true,
          messageOverride: true,
          templateKey: true,
          templateVersion: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      lobbyEntries: {
        include: {
          participant: true,
        },
        orderBy: { requestedAt: 'asc' },
      },
    },
  });

  if (!meeting) {
    throw new AdminStaffAuthError('meeting_not_found', 404);
  }

  const actorParticipant = meeting.participants.find(
    (participant) => participant.staffProfileId === actor.profileId,
  );

  const elevatedModeration = hasStaffCapability(actor, 'meetings.moderate');
  const auditAccess = hasStaffCapability(actor, 'meetings.audit.read');
  const canModerate =
    elevatedModeration ||
    actorParticipant?.role === 'HOST' ||
    actorParticipant?.role === 'COHOST';

  if (!actorParticipant && !elevatedModeration && !auditAccess) {
    throw new AdminStaffAuthError('meeting_access_denied', 403);
  }

  return {
    meeting,
    actorParticipant,
    canModerate,
    canReadAudit: auditAccess || canModerate,
  };
}

export function requireMeetingModeration(input: {
  canModerate: boolean;
}) {
  if (!input.canModerate) {
    throw new AdminStaffAuthError('meeting_moderation_required', 403);
  }
}
