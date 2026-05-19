export type ReminderLikeForGuard = {
  id?: string;
  name?: string;
  time?: string | null;
  scheduledFor?: string | null;
  snoozedUntil?: string | null;
  meta?: Record<string, any> | null;
};

export type TooEarlyResult =
  | {
      blocked: false;
      effectiveAtIso: string | null;
      minutesEarly: 0;
      reminderTimeLabel: string;
    }
  | {
      blocked: true;
      effectiveAtIso: string | null;
      minutesEarly: number;
      reminderTimeLabel: string;
      message: string;
    };

function parseIsoOrNull(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildTodayTime(hhmm?: string | null): Date | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

export function getEffectiveReminderDate(rem: ReminderLikeForGuard): Date | null {
  return (
    parseIsoOrNull(rem.snoozedUntil) ??
    parseIsoOrNull(rem.scheduledFor) ??
    parseIsoOrNull(rem.meta?.scheduledFor) ??
    buildTodayTime(rem.time ?? undefined)
  );
}

export function getEffectiveReminderLabel(rem: ReminderLikeForGuard): string {
  const explicit = rem.time?.trim();
  if (explicit) return explicit;

  const d = getEffectiveReminderDate(rem);
  if (!d) return 'unknown time';

  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function checkReminderTooEarly(rem: ReminderLikeForGuard, now = new Date()): TooEarlyResult {
  const effectiveAt = getEffectiveReminderDate(rem);
  const reminderTimeLabel = getEffectiveReminderLabel(rem);

  if (!effectiveAt) {
    return {
      blocked: false,
      effectiveAtIso: null,
      minutesEarly: 0,
      reminderTimeLabel,
    };
  }

  const diffMs = effectiveAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return {
      blocked: false,
      effectiveAtIso: effectiveAt.toISOString(),
      minutesEarly: 0,
      reminderTimeLabel,
    };
  }

  const minutesEarly = Math.ceil(diffMs / 60000);

  return {
    blocked: true,
    effectiveAtIso: effectiveAt.toISOString(),
    minutesEarly,
    reminderTimeLabel,
    message: `Attempting Action Earlier Than Set Time: The set time for this reminder task is ${reminderTimeLabel}, you're still ${minutesEarly} minute${minutesEarly === 1 ? '' : 's'} away. Please abort this action and you will be reminded at the appropriate time to action the task. Thank you.`,
  };
}