import { prisma } from '@/src/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';

type TrainingNotificationAction =
  | 'scheduled'
  | 'rescheduled'
  | 'cancelled'
  | 'invited';

type TrainingNotificationInput = {
  action: TrainingNotificationAction;
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  trainingSlotId: string;
  title?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone?: string | null;
  mode?: string | null;
  joinUrl?: string | null;
};

function clean(value: unknown, max = 1000): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function validEmail(value: unknown) {
  const email = clean(value, 320) || '';
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

function clinicianAppBaseUrl() {
  return String(
    process.env.CLINICIAN_APP_URL ||
      process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
      process.env.CLINICIAN_APP_ORIGIN ||
      'https://clinician.ambulantplus.co.za',
  ).replace(/\/+$/, '');
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

export async function deliverClinicianTrainingNotification(
  input: TrainingNotificationInput,
) {
  const recipientEmail = clean(input.recipientEmail, 320);
  const recipientUserId = clean(input.recipientUserId, 320);
  const recipientName = clean(input.recipientName, 240) || 'Clinician';
  const trainingSlotId = clean(input.trainingSlotId, 240) || '';
  const title = clean(input.title, 240) || 'Ambulant+ Clinician Training';
  const timezone = clean(input.timezone, 120) || 'Africa/Johannesburg';
  const mode = clean(input.mode, 40) || 'virtual';
  const joinUrl = clean(input.joinUrl, 1200);
  const trainingHubUrl = `${clinicianAppBaseUrl()}/training/schedule`;
  const eventKind = `clinician.training.${input.action}`;

  if (!trainingSlotId) {
    return {
      ok: false,
      eventKind,
      status: 'skipped',
      error: 'training_slot_id_missing',
    };
  }

  if (!recipientEmail || !validEmail(recipientEmail)) {
    return {
      ok: false,
      eventKind,
      status: 'skipped',
      error: 'clinician_email_missing_or_invalid',
    };
  }

  const actionLabel =
    input.action === 'rescheduled'
      ? 'rescheduled'
      : input.action === 'cancelled'
        ? 'cancelled'
        : input.action === 'invited'
          ? 'invited'
          : 'scheduled';

  const subject =
    input.action === 'cancelled'
      ? `Ambulant+ training cancelled - ${title}`
      : input.action === 'invited'
        ? `Ambulant+ training invitation - ${title}`
        : `Ambulant+ training ${actionLabel} - ${title}`;

  const startText = formatWhen(input.startsAt, timezone);
  const endText = formatWhen(input.endsAt, timezone);
  const greeting = `Hello ${recipientName},`;
  const statusLine =
    input.action === 'cancelled'
      ? 'Your scheduled Ambulant+ clinician training has been cancelled.'
      : input.action === 'invited'
        ? 'You have been invited to participate in an Ambulant+ clinician training session.'
        : `Your Ambulant+ clinician training has been ${actionLabel}.`;

  const text = [
    greeting,
    '',
    statusLine,
    '',
    `Training: ${title}`,
    `Start: ${startText}`,
    `End: ${endText}`,
    `Timezone: ${timezone}`,
    `Mode: ${mode === 'in_person' ? 'In person' : 'Virtual'}`,
    joinUrl && input.action !== 'cancelled'
      ? `Join training room: ${joinUrl}`
      : null,
    `My Training: ${trainingHubUrl}`,
    '',
    `Training slot: ${trainingSlotId}`,
  ]
    .filter(Boolean)
    .join('\n');

  const joinHtml =
    joinUrl && input.action !== 'cancelled'
      ? `<p><a href="${escapeHtml(joinUrl)}">Join training room</a></p>`
      : '';

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(statusLine)}</p>`,
    `<p><strong>${escapeHtml(title)}</strong><br />Start: ${escapeHtml(startText)}<br />End: ${escapeHtml(endText)}<br />Timezone: ${escapeHtml(timezone)}<br />Mode: ${escapeHtml(mode === 'in_person' ? 'In person' : 'Virtual')}</p>`,
    joinHtml,
    `<p><a href="${escapeHtml(trainingHubUrl)}">Open My Training</a></p>`,
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
          trainingSlotId,
          title,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          timezone,
          mode,
          joinUrl:
            input.action === 'cancelled'
              ? null
              : joinUrl,
          trainingHubUrl,
          action: input.action,
        },
      },
    });
    outboxId = String(outbox.id);
  } catch (error: any) {
    console.error('[training-notification][outbox-create] error', error);
  }

  try {
    const sent = await sendEmail(
      recipientEmail,
      subject,
      html,
      text,
    );

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
                  clean(sent.error, 1000) ||
                  'email_delivery_failed',
              },
        })
        .catch((error: any) => {
          console.error('[training-notification][outbox-update] error', error);
        });
    }

    return {
      ok: sent.ok,
      eventKind,
      status: sent.ok ? 'sent' : 'failed',
      outboxId,
      recipientEmail,
      error: sent.ok
        ? null
        : clean(sent.error, 1000) ||
          'email_delivery_failed',
    };
  } catch (error: any) {
    const message =
      clean(error?.message, 1000) ||
      'email_delivery_failed';

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
      eventKind,
      status: 'failed',
      outboxId,
      recipientEmail,
      error: message,
    };
  }
}
