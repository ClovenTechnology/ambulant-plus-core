import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/src/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';

const TRAINING_GUEST_ISSUER = 'ambulant-training-guest';
const TRAINING_GUEST_AUDIENCE = 'ambulant-training-guest';

export type TrainingGuestSession = {
  assignmentId: string;
  principalKey: string;
  expiresAt: Date;
};

type TrainingParticipationEmailInput = {
  kind: 'invitation' | 'cancelled';
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientRole: 'clinician' | 'observer' | 'patient';
  assignmentId: string;
  trainingSlotId: string;
  title?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone?: string | null;
  link?: string | null;
};

function clean(value: unknown, max = 1200): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

export function normaliseTrainingInvitationEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function validTrainingInvitationEmail(value: unknown) {
  const email = normaliseTrainingInvitationEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function landingBaseUrl() {
  return String(
    process.env.LANDING_PUBLIC_URL ||
      process.env.LANDING_BASE_URL ||
      process.env.LANDING_APP_URL ||
      process.env.NEXT_PUBLIC_LANDING_APP_URL ||
      process.env.NEXT_PUBLIC_LANDING_URL ||
      'https://ambulantplus.co.za',
  ).replace(/\/+$/, '');
}

function clinicianAppBaseUrl() {
  return String(
    process.env.CLINICIAN_APP_URL ||
      process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
      process.env.CLINICIAN_APP_ORIGIN ||
      'https://clinician.ambulantplus.co.za',
  ).replace(/\/+$/, '');
}

export function randomTrainingInvitationToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashTrainingInvitationToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function externalObserverInvitationUrl(token: string) {
  return `${landingBaseUrl()}/training/join#invite=${encodeURIComponent(token)}`;
}

export function clinicianTrainingInvitationUrl(assignmentId: string) {
  return `${clinicianAppBaseUrl()}/training/invitations/${encodeURIComponent(assignmentId)}`;
}

export function clinicianTrainingRoomUrl(trainingSlotId: string) {
  const slotId = String(trainingSlotId || '').trim();
  const roomId = slotId.startsWith('training-slot-')
    ? slotId
    : `training-slot-${slotId}`;
  return `${clinicianAppBaseUrl()}/training/room/${encodeURIComponent(roomId)}?trainingSlotId=${encodeURIComponent(slotId)}`;
}

function formatWhen(value: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(value);
  } catch {
    return value.toISOString();
  }
}

export async function deliverTrainingParticipationEmail(
  input: TrainingParticipationEmailInput,
) {
  const recipientEmail = normaliseTrainingInvitationEmail(input.recipientEmail);
  const recipientUserId = clean(input.recipientUserId, 320);
  const recipientName = clean(input.recipientName, 240) || 'Participant';
  const assignmentId = clean(input.assignmentId, 240) || '';
  const trainingSlotId = clean(input.trainingSlotId, 240) || '';
  const title = clean(input.title, 240) || 'Ambulant+ Training';
  const timezone = clean(input.timezone, 120) || 'Africa/Johannesburg';
  const link = clean(input.link, 2000);
  const eventKind =
    input.kind === 'cancelled'
      ? 'training.participation.cancelled'
      : 'training.participation.invited';

  if (!assignmentId || !trainingSlotId) {
    return {
      ok: false,
      status: 'skipped',
      eventKind,
      error: 'training_participation_identity_missing',
    };
  }

  if (!recipientEmail || !validTrainingInvitationEmail(recipientEmail)) {
    return {
      ok: false,
      status: 'skipped',
      eventKind,
      error: 'training_participant_email_missing_or_invalid',
    };
  }

  const startText = formatWhen(input.startsAt, timezone);
  const endText = formatWhen(input.endsAt, timezone);
  const roleLabel =
    input.recipientRole === 'observer'
      ? 'observer'
      : input.recipientRole === 'patient'
        ? 'patient participant'
        : 'clinician participant';

  const subject =
    input.kind === 'cancelled'
      ? `Ambulant+ training access cancelled - ${title}`
      : `Ambulant+ training invitation - ${title}`;

  const statusLine =
    input.kind === 'cancelled'
      ? `Your ${roleLabel} participation in this Ambulant+ training session has been cancelled.`
      : `You have been invited as an ${roleLabel} to this Ambulant+ training session.`;

  const text = [
    `Hello ${recipientName},`,
    '',
    statusLine,
    '',
    `Training: ${title}`,
    `Start: ${startText}`,
    `End: ${endText}`,
    `Timezone: ${timezone}`,
    input.kind === 'invitation' && link
      ? `Open secure invitation: ${link}`
      : null,
    '',
    'If you were not expecting this invitation, you can ignore this message.',
  ]
    .filter(Boolean)
    .join('\n');

  const linkHtml =
    input.kind === 'invitation' && link
      ? `<p><a href="${escapeHtml(link)}">Open secure training invitation</a></p>`
      : '';

  const html = [
    `<p>${escapeHtml(`Hello ${recipientName},`)}</p>`,
    `<p>${escapeHtml(statusLine)}</p>`,
    `<p><strong>${escapeHtml(title)}</strong><br />Start: ${escapeHtml(startText)}<br />End: ${escapeHtml(endText)}<br />Timezone: ${escapeHtml(timezone)}</p>`,
    linkHtml,
    '<p>If you were not expecting this invitation, you can ignore this message.</p>',
  ].join('');

  let outboxId: string | null = null;

  try {
    const outbox = await prisma.notificationOutbox.create({
      data: {
        eventKind,
        recipientUserId,
        recipientEmail,
        channel: 'EMAIL',
        payload: {
          assignmentId,
          trainingSlotId,
          title,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          timezone,
          recipientRole: input.recipientRole,
          kind: input.kind,
          // Deliberately exclude the raw invitation link/token from durable outbox payload.
        },
      },
    });
    outboxId = String(outbox.id);
  } catch (error: any) {
    console.error('[training-participation-notification][outbox-create] error', error);
  }

  try {
    const sent = await sendEmail(recipientEmail, subject, html, text);

    if (outboxId) {
      await prisma.notificationOutbox
        .update({
          where: { id: outboxId },
          data: sent.ok
            ? {
                status: 'SENT',
                sentAt: new Date(),
                attempts: { increment: 1 },
                lastError: null,
              }
            : {
                status: 'FAILED',
                attempts: { increment: 1 },
                lastError:
                  clean(sent.error, 1000) || 'email_delivery_failed',
              },
        })
        .catch((error: any) => {
          console.error(
            '[training-participation-notification][outbox-update] error',
            error,
          );
        });
    }

    return {
      ok: sent.ok,
      status: sent.ok ? 'sent' : 'failed',
      eventKind,
      outboxId,
      recipientEmail,
      error: sent.ok
        ? null
        : clean(sent.error, 1000) || 'email_delivery_failed',
    };
  } catch (error: any) {
    const message =
      clean(error?.message, 1000) || 'email_delivery_failed';

    if (outboxId) {
      await prisma.notificationOutbox
        .update({
          where: { id: outboxId },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: message,
          },
        })
        .catch(() => {});
    }

    return {
      ok: false,
      status: 'failed',
      eventKind,
      outboxId,
      recipientEmail,
      error: message,
    };
  }
}

function trainingGuestSecret() {
  const raw = String(
    process.env.TRAINING_GUEST_SESSION_SECRET ||
      process.env.TRAINING_ADMISSION_JWT_SECRET ||
      process.env.TELEVISIT_JOIN_JWT_SECRET ||
      '',
  ).trim();

  if (!raw) {
    throw new Error('training_guest_session_secret_missing');
  }

  return new TextEncoder().encode(raw);
}

export async function issueTrainingGuestSession(input: {
  assignmentId: string;
  principalKey: string;
  expiresAt: Date;
}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const requestedExpiry = Math.floor(input.expiresAt.getTime() / 1000);
  const expiresAtSeconds = Math.max(
    nowSeconds + 60,
    Math.min(requestedExpiry, nowSeconds + 24 * 60 * 60),
  );

  const token = await new SignJWT({
    kind: 'training_guest_session',
    assignmentId: input.assignmentId,
    principalKey: input.principalKey,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(TRAINING_GUEST_ISSUER)
    .setAudience(TRAINING_GUEST_AUDIENCE)
    .setSubject(input.assignmentId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(trainingGuestSecret());

  return {
    token,
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}

export async function verifyTrainingGuestSession(
  token: string,
): Promise<TrainingGuestSession> {
  const raw = String(token || '').trim();
  if (!raw) throw new Error('training_guest_session_required');

  const verified = await jwtVerify(raw, trainingGuestSecret(), {
    issuer: TRAINING_GUEST_ISSUER,
    audience: TRAINING_GUEST_AUDIENCE,
  });

  const assignmentId = String(
    verified.payload.assignmentId || verified.payload.sub || '',
  ).trim();
  const principalKey = String(
    verified.payload.principalKey || '',
  ).trim();

  if (
    verified.payload.kind !== 'training_guest_session' ||
    !assignmentId ||
    !principalKey ||
    !verified.payload.exp
  ) {
    throw new Error('invalid_training_guest_session');
  }

  return {
    assignmentId,
    principalKey,
    expiresAt: new Date(Number(verified.payload.exp) * 1000),
  };
}

export async function recordTrainingParticipationAudit(
  action: string,
  input: {
    actorUserId?: string | null;
    actorType?: string | null;
    actorRefId?: string | null;
    assignmentId?: string | null;
    trainingSlotId?: string | null;
    description?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: clean(input.actorUserId, 240),
        actorType:
          String(input.actorType || '').trim().toUpperCase() === 'ADMIN'
            ? 'ADMIN'
            : 'SYSTEM',
        actorRefId: clean(input.actorRefId, 240),
        app: 'api-gateway',
        action: clean(action, 120) || 'training.participation',
        entityType: 'ClinicianTrainingParticipantAssignment',
        entityId:
          clean(input.assignmentId, 240) ||
          clean(input.trainingSlotId, 240) ||
          'training',
        description: clean(input.description, 1000),
        meta: {
          trainingSlotId: clean(input.trainingSlotId, 240),
          ...(input.meta || {}),
        },
      },
    });
  } catch (error) {
    console.error('[training-participation-audit] failed', error);
  }
}
