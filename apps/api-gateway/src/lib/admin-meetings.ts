import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';
import {
  effectiveMeetingInvitationState,
  guestPinLocked,
  meetingJoinWindow,
  normaliseMeetingEmail,
  validMeetingEmail,
} from '@/src/lib/admin-meetings-policy';

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60_000;

export function cleanMeetingText(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

export function randomOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashClientValue(value: string) {
  const pepper = process.env.MEETING_CLIENT_HASH_PEPPER || process.env.TELEVISIT_JOIN_JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

export function generatedGuestPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashGuestPin(pin: string) {
  const normalized = cleanMeetingText(pin, 32);
  if (!normalized) return null;
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(normalized, salt, 32);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyGuestPin(pin: string, stored: string | null | undefined) {
  if (!stored) return true;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(cleanMeetingText(pin, 32), salt, expected.length);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function meetingPublicBaseUrl() {
  return (
    process.env.LANDING_PUBLIC_URL ||
    process.env.LANDING_BASE_URL ||
    process.env.NEXT_PUBLIC_LANDING_URL ||
    'https://ambulantplus.co.za'
  ).replace(/\/+$/, '');
}

export function meetingGuestJoinUrl(token: string) {
  // Keep the bearer invitation in the URL fragment so it is not sent in HTTP
  // request lines, server logs or Referer headers. The public join page removes
  // the fragment immediately after successful verification.
  return `${meetingPublicBaseUrl()}/meetings/join#invite=${encodeURIComponent(token)}`;
}

export function parseGuestSessionHeader(headers: Headers) {
  return cleanMeetingText(
    headers.get('x-meeting-guest-session') ||
      headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
    800,
  );
}

export function requestIp(headers: Headers) {
  return cleanMeetingText(
    headers.get('x-forwarded-for')?.split(',')[0] ||
      headers.get('x-real-ip') ||
      '',
    120,
  );
}

export async function writeMeetingAudit(input: {
  actorUserId?: string | null;
  actorRefId?: string | null;
  actorType?: 'ADMIN' | 'SYSTEM' | 'EXTERNAL_GUEST';
  action: string;
  meetingId?: string | null;
  description?: string | null;
  userAgent?: string | null;
  meta?: Prisma.InputJsonObject;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId || null,
        actorType: input.actorType || 'ADMIN',
        actorRefId: input.actorRefId || null,
        app: 'admin-meetings',
        action: input.action,
        entityType: input.meetingId ? 'Meeting' : null,
        entityId: input.meetingId || null,
        description: input.description || null,
        userAgent: input.userAgent || null,
        meta: input.meta,
      },
    });
  } catch (error) {
    console.warn('[admin-meetings] audit write failed', error);
  }
}

export function meetingInviteEmail(input: {
  title: string;
  startsAt: Date;
  timezone: string;
  durationMinutes: number;
  link: string;
  customMessage?: string | null;
  subjectOverride?: string | null;
}) {
  const subject =
    cleanMeetingText(input.subjectOverride, 240) ||
    `Invitation: ${cleanMeetingText(input.title, 180) || 'Ambulant+ meeting'}`;

  const customMessage = cleanMeetingText(input.customMessage, 4000);
  let when = `${input.startsAt.toISOString()} (${input.timezone})`;
  try {
    when = new Intl.DateTimeFormat('en-ZA', {
      timeZone: input.timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(input.startsAt) + ` (${input.timezone})`;
  } catch {
    // The meeting creation boundary validates IANA timezones. Keep a stable
    // ISO fallback in case an older record contains an invalid value.
  }

  const text = [
    'You have been invited to an Ambulant+ meeting.',
    '',
    `Meeting: ${input.title}`,
    `Starts: ${when}`,
    `Duration: ${input.durationMinutes} minutes`,
    customMessage ? '' : null,
    customMessage || null,
    '',
    'Open your secure invitation link:',
    input.link,
    '',
    'If a PIN is required, the organiser will provide it separately.',
    'Do not forward this invitation link.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6">
      <div style="max-width:680px;margin:auto;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
        <div style="background:#020617;color:white;padding:24px">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#67e8f9;font-weight:700">Ambulant+ meeting invitation</div>
          <h1 style="margin:10px 0 0;font-size:24px">${escapeHtml(input.title)}</h1>
        </div>
        <div style="padding:24px;background:white">
          <p><strong>Starts:</strong> ${escapeHtml(when)}</p>
          <p><strong>Duration:</strong> ${input.durationMinutes} minutes</p>
          ${customMessage ? `<div style="margin:20px 0;padding:16px;border-radius:14px;background:#f8fafc">${escapeHtml(customMessage)}</div>` : ''}
          <p><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0f172a;color:white;text-decoration:none;font-weight:700">Open secure invitation</a></p>
          <p style="font-size:12px;color:#64748b">If a PIN is required, the organiser will provide it separately. Do not forward this invitation link.</p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export async function deliverMeetingInvitation(input: {
  invitationId: string;
  email: string;
  title: string;
  startsAt: Date;
  timezone: string;
  durationMinutes: number;
  link: string;
  customMessage?: string | null;
  subjectOverride?: string | null;
  meetingId: string;
}) {
  const email = normaliseMeetingEmail(input.email);
  const payload = meetingInviteEmail(input);

  const outbox = await prisma.notificationOutbox.create({
    data: {
      eventKind: 'meeting.invitation.created',
      recipientEmail: email,
      channel: 'EMAIL',
      payload: {
        meetingId: input.meetingId,
        invitationId: input.invitationId,
        title: input.title,
        startsAt: input.startsAt.toISOString(),
        timezone: input.timezone,
      },
    },
  });

  const sent = await sendEmail(email, payload.subject, payload.html, payload.text);

  await prisma.notificationOutbox.update({
    where: { id: outbox.id },
    data: sent.ok
      ? { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
      : { status: 'FAILED', attempts: { increment: 1 }, lastError: cleanMeetingText(sent.error, 1000) || 'email_delivery_failed' },
  });

  return sent;
}

export async function createExternalMeetingInvitation(input: {
  meeting: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    durationMinutes: number;
  };
  email: string;
  displayName?: string | null;
  role?: 'ATTENDEE' | 'INTERVIEWEE' | 'PRESENTER';
  createdByProfileId: string;
  requirePin?: boolean;
  pin?: string | null;
  subjectOverride?: string | null;
  messageOverride?: string | null;
  templateKey?: string | null;
  templateVersion?: string | null;
  sendEmail?: boolean;
}) {
  const emailNormalized = normaliseMeetingEmail(input.email);
  if (!validMeetingEmail(emailNormalized)) {
    throw new Error('invalid_external_email');
  }

  const token = randomOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const rawPin = input.requirePin
    ? cleanMeetingText(input.pin, 32) || generatedGuestPin()
    : null;
  const pinHash = rawPin ? hashGuestPin(rawPin) : null;

  const inviteExpiry = new Date(
    Math.max(
      input.meeting.endsAt.getTime() + 60 * 60_000,
      Date.now() + 60 * 60_000,
    ),
  );

  const created = await prisma.$transaction(async (tx) => {
    const participant = await tx.meetingParticipant.create({
      data: {
        meetingId: input.meeting.id,
        participantType: 'EXTERNAL_GUEST',
        emailNormalized,
        displayName: cleanMeetingText(input.displayName, 240) || emailNormalized,
        role: input.role || 'ATTENDEE',
        state: 'INVITED',
      },
    });

    const invitation = await tx.meetingInvitation.create({
      data: {
        meetingId: input.meeting.id,
        participantId: participant.id,
        emailNormalized,
        tokenHash,
        pinHash,
        state: 'PENDING',
        expiresAt: inviteExpiry,
        createdByProfileId: input.createdByProfileId,
        subjectOverride: cleanMeetingText(input.subjectOverride, 240) || null,
        messageOverride: cleanMeetingText(input.messageOverride, 4000) || null,
        templateKey: cleanMeetingText(input.templateKey, 120) || null,
        templateVersion: cleanMeetingText(input.templateVersion, 80) || null,
      },
    });

    return { participant, invitation };
  });

  const link = meetingGuestJoinUrl(token);
  let emailDelivery: { ok: boolean; error?: string } | null = null;

  if (input.sendEmail !== false) {
    emailDelivery = await deliverMeetingInvitation({
      invitationId: created.invitation.id,
      email: emailNormalized,
      title: input.meeting.title,
      startsAt: input.meeting.startsAt,
      timezone: input.meeting.timezone,
      durationMinutes: input.meeting.durationMinutes,
      link,
      customMessage: input.messageOverride,
      subjectOverride: input.subjectOverride,
      meetingId: input.meeting.id,
    });
  }

  return {
    participant: created.participant,
    invitation: created.invitation,
    oneTime: {
      link,
      pin: rawPin,
    },
    emailDelivery,
  };
}

export async function resolveGuestInvitation(token: string) {
  const tokenHash = hashOpaqueToken(cleanMeetingText(token, 800));
  return prisma.meetingInvitation.findUnique({
    where: { tokenHash },
    include: {
      meeting: true,
      participant: true,
    },
  });
}

export async function verifyGuestInvitation(input: {
  token: string;
  pin?: string | null;
  headers: Headers;
}) {
  const invitation = await resolveGuestInvitation(input.token);
  const now = new Date();

  if (
    !invitation ||
    effectiveMeetingInvitationState(invitation as any, now) === 'REVOKED' ||
    effectiveMeetingInvitationState(invitation as any, now) === 'EXPIRED' ||
    invitation.meeting.state === 'ENDED' ||
    invitation.meeting.state === 'CANCELLED' ||
    invitation.meeting.state === 'EXPIRED'
  ) {
    throw new Error('invalid_or_expired_invitation');
  }

  if (guestPinLocked(invitation as any, now)) {
    throw new Error('invalid_or_expired_invitation');
  }

  if (invitation.pinHash && !verifyGuestPin(cleanMeetingText(input.pin, 32), invitation.pinHash)) {
    const nextAttempts = invitation.attemptCount + 1;
    await prisma.meetingInvitation.update({
      where: { id: invitation.id },
      data: {
        attemptCount: nextAttempts,
        lockedUntil: nextAttempts >= PIN_MAX_ATTEMPTS
          ? new Date(now.getTime() + PIN_LOCK_MS)
          : null,
      },
    });

    throw new Error('invalid_or_expired_invitation');
  }

  const sessionToken = randomOpaqueToken();
  const sessionTokenHash = hashOpaqueToken(sessionToken);
  const sessionExpiresAt = new Date(
    Math.min(
      invitation.expiresAt.getTime(),
      invitation.meeting.endsAt.getTime() + 60 * 60_000,
    ),
  );

  const ip = requestIp(input.headers);

  const session = await prisma.$transaction(async (tx) => {
    const claimedInvitation = await tx.meetingInvitation.updateMany({
      where: {
        id: invitation.id,
        revokedAt: null,
        expiresAt: { gt: now },
        state: { in: ['PENDING', 'VERIFIED'] },
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lte: now } },
        ],
      },
      data: {
        state: 'VERIFIED',
        verifiedAt: invitation.verifiedAt || now,
        lastUsedAt: now,
        attemptCount: 0,
        lockedUntil: null,
      },
    });

    if (claimedInvitation.count !== 1) {
      throw new Error('invalid_or_expired_invitation');
    }

    await tx.meetingParticipant.update({
      where: { id: invitation.participantId },
      data: {
        state: invitation.participant.state === 'INVITED' ? 'ACCEPTED' : invitation.participant.state,
        acceptedAt: invitation.participant.acceptedAt || now,
      },
    });

    await tx.meetingGuestSession.updateMany({
      where: {
        invitationId: invitation.id,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    const guestSession = await tx.meetingGuestSession.create({
      data: {
        invitationId: invitation.id,
        sessionTokenHash,
        expiresAt: sessionExpiresAt,
        ipHash: ip ? hashClientValue(ip) : null,
        userAgent: cleanMeetingText(input.headers.get('user-agent'), 1000) || null,
      },
    });

    if (
      invitation.meeting.kind === 'INTERVIEW' &&
      invitation.meeting.contextType === 'APPLICATION_INTERVIEW' &&
      invitation.meeting.contextId &&
      invitation.participant.role === 'INTERVIEWEE'
    ) {
      const moved = await tx.application.updateMany({
        where: {
          id: invitation.meeting.contextId,
          status: 'INTERVIEW_INVITED',
        },
        data: {
          status: 'INTERVIEW_SCHEDULED',
          statusReason: null,
          statusChangedAt: now,
        },
      });

      if (moved.count === 1) {
        await tx.applicationStatusEvent.create({
          data: {
            applicationId: invitation.meeting.contextId,
            fromStatus: 'INTERVIEW_INVITED',
            toStatus: 'INTERVIEW_SCHEDULED',
            actorType: 'EXTERNAL_GUEST',
            actorRefId: guestSession.id,
            metadata: {
              source: 'application_interview_meeting_guest_verification',
              meetingId: invitation.meetingId,
              invitationId: invitation.id,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: 'EXTERNAL_GUEST',
            actorRefId: guestSession.id,
            app: 'api-gateway',
            action: 'application.interview.accepted_via_meeting_access',
            entityType: 'Application',
            entityId: invitation.meeting.contextId,
            meta: {
              meetingId: invitation.meetingId,
              invitationId: invitation.id,
            },
          },
        });
      }
    }

    return guestSession;
  });

  await writeMeetingAudit({
    actorType: 'EXTERNAL_GUEST',
    action: 'meeting.guest.verified',
    meetingId: invitation.meetingId,
    description: 'External guest invitation verified',
    userAgent: input.headers.get('user-agent'),
    meta: {
      invitationId: invitation.id,
      participantId: invitation.participantId,
      email: invitation.emailNormalized,
    },
  });

  return {
    sessionToken,
    session,
    meeting: invitation.meeting,
    participant: invitation.participant,
  };
}

export async function resolveGuestSession(sessionToken: string) {
  const token = cleanMeetingText(sessionToken, 800);
  if (!token) return null;

  const sessionTokenHash = hashOpaqueToken(token);
  const session = await prisma.meetingGuestSession.findUnique({
    where: { sessionTokenHash },
    include: {
      invitation: {
        include: {
          meeting: true,
          participant: true,
        },
      },
      lobbyEntries: true,
    },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (
    session.invitation.revokedAt ||
    session.invitation.meeting.state === 'ENDED' ||
    session.invitation.meeting.state === 'CANCELLED' ||
    session.invitation.meeting.state === 'EXPIRED'
  ) {
    return null;
  }

  return session;
}

function livekitHttpUrl(value: string) {
  if (value.startsWith('wss://')) return `https://${value.slice(6)}`;
  if (value.startsWith('ws://')) return `http://${value.slice(5)}`;
  return value;
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

export async function meetingRoomServiceClient() {
  const key = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const secret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const rawUrl = envFirst([
    'LIVEKIT_API_URL',
    'LIVEKIT_WS_URL',
    'LIVEKIT_URL',
    'LK_URL',
    'LK_WS_URL',
  ]);

  if (!key || !secret || !rawUrl) {
    throw new Error('server_misconfig_missing_livekit_creds');
  }

  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(livekitHttpUrl(rawUrl), key, secret);
}

export async function mintMeetingRtcAccess(input: {
  meeting: any;
  participant: any;
  identity: string;
  displayName: string;
}) {
  const joinWindow = meetingJoinWindow({
    state: input.meeting.state,
    startsAt: input.meeting.startsAt,
    endsAt: input.meeting.endsAt,
  });

  if (!joinWindow.open) {
    throw new Error(joinWindow.reason || 'meeting_not_open');
  }

  if (input.meeting.lockedAt && !['HOST', 'COHOST'].includes(String(input.participant.role))) {
    throw new Error('meeting_locked');
  }

  const { mintAdminLiveKitAccess } =
    await import(
      '@/src/lib/admin-livekit-access'
    );

  return mintAdminLiveKitAccess({
    roomId: input.meeting.roomId,
    identity:
      cleanMeetingText(
        input.identity,
        240,
      ),
    displayName:
      cleanMeetingText(
        input.displayName,
        240,
      ),
    metadata: {
      kind: 'ambulant_meeting',
      meetingId: input.meeting.id,
      participantId: input.participant.id,
      participantType: input.participant.participantType,
      participantRole: input.participant.role,
    },
    roomAdmin:
      ['HOST', 'COHOST'].includes(
        String(input.participant.role),
      ),
  });
}

export function publicMeetingSummary(meeting: any) {
  return {
    id: meeting.id,
    kind: meeting.kind,
    state: meeting.state,
    title: meeting.title,
    agenda: meeting.agenda,
    timezone: meeting.timezone,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    durationMinutes: meeting.durationMinutes,
    allowAudio: meeting.allowAudio,
    allowVideo: meeting.allowVideo,
    allowChat: meeting.allowChat,
    allowFiles: meeting.allowFiles,
    allowScreenShare: meeting.allowScreenShare,
    allowRecording: meeting.allowRecording,
    lobbyRequired: meeting.lobbyRequired,
    locked: Boolean(meeting.lockedAt),
  };
}
