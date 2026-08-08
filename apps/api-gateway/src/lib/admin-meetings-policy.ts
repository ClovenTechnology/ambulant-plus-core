export type MeetingState =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RINGING'
  | 'LIVE'
  | 'ENDED'
  | 'CANCELLED'
  | 'EXPIRED';

export type MeetingKind =
  | 'STANDARD'
  | 'DIRECT_CALL'
  | 'INTERVIEW';

export type MeetingInvitationState =
  | 'PENDING'
  | 'VERIFIED'
  | 'REVOKED'
  | 'EXPIRED';

const MEETING_TRANSITIONS: Record<MeetingState, MeetingState[]> = {
  DRAFT: ['SCHEDULED', 'RINGING', 'CANCELLED'],
  SCHEDULED: ['LIVE', 'CANCELLED', 'EXPIRED'],
  RINGING: ['LIVE', 'CANCELLED', 'EXPIRED'],
  LIVE: ['ENDED'],
  ENDED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const MEETING_STATES = new Set<MeetingState>([
  'DRAFT',
  'SCHEDULED',
  'RINGING',
  'LIVE',
  'ENDED',
  'CANCELLED',
  'EXPIRED',
]);

export function isMeetingState(value: unknown): value is MeetingState {
  return MEETING_STATES.has(String(value || '').trim().toUpperCase() as MeetingState);
}

export function canTransitionMeetingState(from: MeetingState, to: MeetingState) {
  if (from === to) return true;
  return MEETING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function normaliseMeetingEmail(value: unknown) {
  return String(value || '').trim().toLowerCase().slice(0, 320);
}

export function validMeetingEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function clampMeetingDurationMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60;
  return Math.max(5, Math.min(24 * 60, Math.floor(parsed)));
}

export function validMeetingTimezone(value: unknown) {
  const timezone = String(value || '').trim();
  if (!timezone || timezone.length > 120) return false;

  try {
    new Intl.DateTimeFormat('en-ZA', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  // Some Intl implementations can represent midnight as hour 24.
  const hour = values.hour === 24 ? 0 : values.hour;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour,
    minute: values.minute,
    second: values.second,
  };
}

export function zonedLocalMeetingStart(value: unknown, timezone: string) {
  if (!validMeetingTimezone(timezone)) return null;

  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) return null;

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || '0'),
  };

  if (
    desired.month < 1 || desired.month > 12 ||
    desired.day < 1 || desired.day > 31 ||
    desired.hour < 0 || desired.hour > 23 ||
    desired.minute < 0 || desired.minute > 59 ||
    desired.second < 0 || desired.second > 59
  ) {
    return null;
  }

  const desiredUtcLike = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );

  let guess = desiredUtcLike;

  // Iteratively remove the timezone offset at the candidate instant. Two passes
  // are enough for normal offsets and DST boundaries; a third makes the result
  // deterministic across Intl implementations.
  for (let pass = 0; pass < 3; pass += 1) {
    const rendered = zonedParts(new Date(guess), timezone);
    const renderedUtcLike = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    guess += desiredUtcLike - renderedUtcLike;
  }

  const result = new Date(guess);
  if (!Number.isFinite(result.getTime())) return null;

  const roundTrip = zonedParts(result, timezone);
  if (
    roundTrip.year !== desired.year ||
    roundTrip.month !== desired.month ||
    roundTrip.day !== desired.day ||
    roundTrip.hour !== desired.hour ||
    roundTrip.minute !== desired.minute ||
    roundTrip.second !== desired.second
  ) {
    // Reject nonexistent local wall-clock times such as a DST spring-forward gap.
    return null;
  }

  return result;
}

export function meetingJoinWindow(input: {
  state: MeetingState;
  startsAt: Date | string;
  endsAt: Date | string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    endsAt.getTime() <= startsAt.getTime()
  ) {
    return { open: false, reason: 'invalid_schedule' as const };
  }

  if (input.state === 'ENDED' || input.state === 'CANCELLED' || input.state === 'EXPIRED') {
    return { open: false, reason: 'meeting_closed' as const };
  }

  const opensAt = new Date(startsAt.getTime() - 30 * 60_000);
  const closesAt = new Date(endsAt.getTime() + 60 * 60_000);

  if (now.getTime() < opensAt.getTime()) {
    return { open: false, reason: 'meeting_not_open' as const, opensAt, closesAt };
  }

  if (now.getTime() > closesAt.getTime()) {
    return { open: false, reason: 'meeting_window_closed' as const, opensAt, closesAt };
  }

  return { open: true, reason: null, opensAt, closesAt };
}

export function effectiveMeetingInvitationState(input: {
  state: MeetingInvitationState;
  expiresAt: Date | string;
  revokedAt?: Date | string | null;
}, now = new Date()): MeetingInvitationState {
  if (input.revokedAt || input.state === 'REVOKED') return 'REVOKED';
  const expiry = new Date(input.expiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  return input.state;
}

export function guestPinLocked(input: {
  attemptCount?: number | null;
  lockedUntil?: Date | string | null;
}, now = new Date()) {
  if (!input.lockedUntil) return false;
  const until = new Date(input.lockedUntil);
  return Number.isFinite(until.getTime()) && until.getTime() > now.getTime();
}
