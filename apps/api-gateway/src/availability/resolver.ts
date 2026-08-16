// apps/api-gateway/src/availability/resolver.ts
import { prisma } from '@/src/lib/db';
import { getAdminPolicy, getClinicianConsult } from '@/src/store/consult';
import {
  getSchedule,
  type DayKey,
  type DayTemplate,
  type ScheduleConfig,
} from '@/src/store/schedule';

export type ConsultType = 'standard' | 'followup';
export type AvailabilitySlotStatus =
  | 'available'
  | 'limited'
  | 'blocked'
  | 'booked'
  | 'past';

export type AvailabilitySlot = {
  start: string;
  end: string;
  localStart: string;
  localEnd: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  localTimeLabel: string;
  timezone: string;
  status: AvailabilitySlotStatus;
  reason?: string;
  consultType: ConsultType;
  feeCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
};

type SlotRange = { start: string; end: string };
type ScheduleException = { date: string; reason?: string };

type ClinicianRecord = {
  id: string;
  userId?: string | null;
  email?: string | null;
  status?: string | null;
  disabled?: boolean | null;
  archived?: boolean | null;
  trainingCompleted?: boolean | null;
  feeCents?: number | null;
  currency?: string | null;
  meta?: unknown;
};

export type AvailabilityContract = {
  clinician: ClinicianRecord;
  clinicianId: string;
  clinicianUserId: string;
  timezone: string;
  template: Record<DayKey, DayTemplate>;
  exceptions: ScheduleException[];
  slotMin: string;
  slotMax: string;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  standard: {
    feeCents: number;
    currency: string;
    durationMin: number;
    bufferMin: number;
  };
  followup: {
    feeCents: number;
    currency: string;
    durationMin: number;
    bufferMin: number;
  };
  selected: {
    feeCents: number;
    currency: string;
    durationMin: number;
    bufferMin: number;
  };
  scheduleMatchedUserId: string | null;
  sources: {
    scheduleSource: string;
    consultSource: string;
    feeSource: string;
    bufferSource: string;
  };
};

export class AvailabilityError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, status = 400, details?: unknown) {
    super(code);
    this.name = 'AvailabilityError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const DAY_KEYS: DayKey[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

const DEFAULT_TEMPLATE: Record<DayKey, DayTemplate> = {
  mon: {
    enabled: true,
    ranges: [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
  },
  tue: {
    enabled: true,
    ranges: [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
  },
  wed: {
    enabled: true,
    ranges: [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
  },
  thu: {
    enabled: true,
    ranges: [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
  },
  fri: {
    enabled: true,
    ranges: [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
  },
  sat: {
    enabled: false,
    ranges: [{ start: '09:00', end: '12:00' }],
  },
  sun: { enabled: false, ranges: [] },
};

function cleanStr(value: unknown): string | null {
  const valueString = String(value ?? '').trim();
  return valueString.length ? valueString : null;
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeParseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function safeParseArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function readProfileJson(clinician: ClinicianRecord) {
  const meta = safeParseObject(clinician.meta);
  const rawProfileJson = safeParseObject(meta.rawProfileJson);
  const rawProfile = safeParseObject(meta.rawProfile);
  const submittedProfile = safeParseObject(meta.submittedProfile);

  return {
    meta,
    profile: {
      ...meta,
      ...submittedProfile,
      ...rawProfile,
      ...rawProfileJson,
    },
  };
}

function unique(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'ZAR';
}

function amountCents(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }

  return 0;
}

export function normalizeConsultType(value: unknown): ConsultType {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'followup' || normalized === 'follow-up'
    ? 'followup'
    : 'standard';
}

export function isValidAvailabilityDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime())
  );
}

export function addAvailabilityDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number);
  const value = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayKey(ymd: string): DayKey {
  const date = new Date(`${ymd}T12:00:00.000Z`);
  return DAY_KEYS[date.getUTCDay()] || 'mon';
}

function normalizeHhmm(value: unknown, fallback: string) {
  const text = String(value || '').slice(0, 5);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function hhmmMinutes(hhmm: unknown) {
  const [hoursRaw, minutesRaw] = String(hhmm || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);

  const hours = Number.isFinite(hoursRaw) ? hoursRaw : 0;
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 0;

  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

function normalizeTemplate(
  template: unknown,
): Record<DayKey, DayTemplate> {
  const parsed = safeParseObject(template);
  const output: Record<DayKey, DayTemplate> = {
    mon: { ...DEFAULT_TEMPLATE.mon, ranges: [...DEFAULT_TEMPLATE.mon.ranges] },
    tue: { ...DEFAULT_TEMPLATE.tue, ranges: [...DEFAULT_TEMPLATE.tue.ranges] },
    wed: { ...DEFAULT_TEMPLATE.wed, ranges: [...DEFAULT_TEMPLATE.wed.ranges] },
    thu: { ...DEFAULT_TEMPLATE.thu, ranges: [...DEFAULT_TEMPLATE.thu.ranges] },
    fri: { ...DEFAULT_TEMPLATE.fri, ranges: [...DEFAULT_TEMPLATE.fri.ranges] },
    sat: { ...DEFAULT_TEMPLATE.sat, ranges: [...DEFAULT_TEMPLATE.sat.ranges] },
    sun: { ...DEFAULT_TEMPLATE.sun, ranges: [...DEFAULT_TEMPLATE.sun.ranges] },
  };

  for (const day of Object.keys(DEFAULT_TEMPLATE) as DayKey[]) {
    const raw = parsed?.[day];

    if (!raw || typeof raw !== 'object') {
      continue;
    }

    const ranges: SlotRange[] = Array.isArray(raw.ranges)
      ? raw.ranges
          .map((range: any) => ({
            start: normalizeHhmm(range?.start, '09:00'),
            end: normalizeHhmm(range?.end, '17:00'),
          }))
          .filter(
            (range: SlotRange) =>
              Boolean(range.start) && Boolean(range.end),
          )
      : [];

    output[day] = {
      enabled: raw.enabled !== false,
      ranges,
    };
  }

  return output;
}

function normalizeExceptions(value: unknown): ScheduleException[] {
  const array = safeParseArray(value);

  return array
    .map((item: any) => {
      const reason = cleanStr(item?.reason);

      return {
        date: String(item?.date || item || '').slice(0, 10),
        ...(reason ? { reason } : {}),
      };
    })
    .filter((item) => isValidAvailabilityDate(item.date));
}

function getOffsetMinutes(timeZone: string, instant: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(instant);

    const bag: Record<string, string> = {};

    for (const part of parts) {
      if (part.type !== 'literal') {
        bag[part.type] = part.value;
      }
    }

    const asUtc = Date.UTC(
      Number(bag.year),
      Number(bag.month) - 1,
      Number(bag.day),
      Number(bag.hour),
      Number(bag.minute),
      Number(bag.second),
    );

    return Math.round((asUtc - instant.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function localDateTimeToUtc(
  ymd: string,
  hhmm: string,
  timeZone: string,
) {
  const [year, month, day] = ymd.split('-').map(Number);
  const [hours, minutes] = normalizeHhmm(hhmm, '00:00')
    .split(':')
    .map(Number);

  const assumedUtc = new Date(
    Date.UTC(
      year,
      (month || 1) - 1,
      day || 1,
      hours || 0,
      minutes || 0,
      0,
    ),
  );

  let offset = getOffsetMinutes(timeZone, assumedUtc);
  let utc = new Date(assumedUtc.getTime() - offset * 60000);

  const refinedOffset = getOffsetMinutes(timeZone, utc);

  if (refinedOffset !== offset) {
    offset = refinedOffset;
    utc = new Date(assumedUtc.getTime() - offset * 60000);
  }

  return utc;
}

function localPartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const bag: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      bag[part.type] = part.value;
    }
  }

  return {
    ymd: `${bag.year}-${bag.month}-${bag.day}`,
    hhmm: `${bag.hour}:${bag.minute}`,
  };
}

function localSlotDisplay(
  start: Date,
  end: Date,
  timeZone: string,
) {
  const startLocal = localPartsInTimeZone(start, timeZone);
  const endLocal = localPartsInTimeZone(end, timeZone);

  return {
    localStart: `${startLocal.ymd}T${startLocal.hhmm}`,
    localEnd: `${endLocal.ymd}T${endLocal.hhmm}`,
    localDate: startLocal.ymd,
    localStartTime: startLocal.hhmm,
    localEndTime: endLocal.hhmm,
    localTimeLabel: `${startLocal.hhmm} - ${endLocal.hhmm}`,
    timezone: timeZone,
  };
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function overlaps(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function clinicianIdentityKeys(clinician: ClinicianRecord) {
  return unique([
    clinician.userId,
    clinician.id,
    clinician.email,
  ]);
}

export async function resolveAvailabilityClinician(
  identifier: string,
): Promise<ClinicianRecord> {
  const requested = String(identifier || '').trim();

  if (!requested) {
    throw new AvailabilityError('clinician_id_required', 400);
  }

  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: [
        { id: requested },
        { userId: requested },
        { email: requested },
      ],
    },
    select: {
      id: true,
      userId: true,
      email: true,
      status: true,
      disabled: true,
      archived: true,
      trainingCompleted: true,
      feeCents: true,
      currency: true,
      meta: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!clinician) {
    throw new AvailabilityError(
      'unknown_clinician',
      404,
      { requestedId: requested },
    );
  }

  return clinician as ClinicianRecord;
}

async function loadScheduleForClinician(
  clinician: ClinicianRecord,
): Promise<{
  schedule: ScheduleConfig;
  source: string;
  matchedUserId: string | null;
}> {
  const keys = clinicianIdentityKeys(clinician);
  const canonicalUserId = String(
    clinician.userId || clinician.id || '',
  ).trim();

  if (keys.length) {
    try {
      const rows = await (prisma as any).clinicianSchedule.findMany({
        where: { userId: { in: keys } },
        select: {
          userId: true,
          country: true,
          timezone: true,
          template: true,
          exceptions: true,
        },
      });

      if (Array.isArray(rows) && rows.length) {
        const preferred = unique([
          canonicalUserId,
          clinician.userId,
          clinician.id,
          clinician.email,
        ]);

        const row = rows
          .slice()
          .sort(
            (left: any, right: any) =>
              preferred.indexOf(String(left.userId || '')) -
              preferred.indexOf(String(right.userId || '')),
          )[0];

        return {
          schedule: {
            country: cleanStr(row.country) || 'ZA',
            timezone:
              cleanStr(row.timezone) || 'Africa/Johannesburg',
            template: normalizeTemplate(row.template),
            exceptions: normalizeExceptions(row.exceptions),
          },
          source: 'clinician_settings_schedule',
          matchedUserId: cleanStr(row.userId),
        };
      }
    } catch (error) {
      console.error(
        '[availability-resolver] alias schedule lookup failed',
        error,
      );
    }
  }

  const fallback = await getSchedule(canonicalUserId);

  return {
    schedule: {
      country: fallback.country || 'ZA',
      timezone:
        fallback.timezone || 'Africa/Johannesburg',
      template: normalizeTemplate(fallback.template),
      exceptions: normalizeExceptions(fallback.exceptions),
    },
    source: 'fallback_default_schedule',
    matchedUserId: null,
  };
}

async function loadActiveFees(clinician: ClinicianRecord) {
  try {
    const rows = await (prisma as any).clinicianFee.findMany({
      where: {
        clinicianUserId: clinician.userId || clinician.id,
        active: true,
        kind: { in: ['STANDARD', 'FOLLOWUP'] },
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        kind: true,
        currency: true,
        amountMinor: true,
      },
    });

    return {
      standard:
        rows.find(
          (row: any) =>
            String(row.kind).toUpperCase() === 'STANDARD',
        ) || null,
      followup:
        rows.find(
          (row: any) =>
            String(row.kind).toUpperCase() === 'FOLLOWUP',
        ) || null,
    };
  } catch {
    return {
      standard: null,
      followup: null,
    };
  }
}

export async function loadAvailabilityConfig(
  clinicianRef: string,
  consultTypeInput: unknown = 'standard',
): Promise<AvailabilityContract> {
  const consultType = normalizeConsultType(consultTypeInput);
  const clinician = await resolveAvailabilityClinician(clinicianRef);
  const { profile } = readProfileJson(clinician);

  const clinicianUserId = String(
    clinician.userId || clinician.id,
  ).trim();

  const [
    scheduleResult,
    adminPolicy,
    consultSettings,
    fees,
  ] = await Promise.all([
    loadScheduleForClinician(clinician),
    getAdminPolicy(),
    getClinicianConsult(clinicianUserId),
    loadActiveFees(clinician),
  ]);

  const timezone =
    cleanStr(scheduleResult.schedule.timezone) ||
    cleanStr(profile.timezone) ||
    'Africa/Johannesburg';

  const adminBuffer = Math.max(
    0,
    Math.round(num(adminPolicy.bufferAfterMinutes, 5)),
  );

  const storedConsult = safeParseObject(
    profile.consultSettings,
  );

  const profileBuffer = num(
    storedConsult.bufferMinutes ??
      profile.bufferMinutes ??
      profile.bufferMin,
    adminBuffer,
  );

  const bufferMin = Math.max(
    0,
    Math.round(profileBuffer),
  );

  const standardDurationMin = Math.max(
    1,
    Math.round(consultSettings.defaultStandardMin),
  );

  const followupDurationMin = Math.max(
    1,
    Math.round(consultSettings.defaultFollowupMin),
  );

  const minAdvanceMinutes = Math.max(
    0,
    Math.round(consultSettings.minAdvanceMinutes),
  );

  const maxAdvanceDays = Math.max(
    1,
    Math.round(consultSettings.maxAdvanceDays),
  );

  const baseCurrency = normalizeCurrency(
    fees.standard?.currency ||
      fees.followup?.currency ||
      clinician.currency ||
      profile.currency ||
      'ZAR',
  );

  const standardCents = amountCents(
    fees.standard?.amountMinor,
    clinician.feeCents,
    profile.feeCents,
    profile.standardFeeCents,
    profile.standardConsultFeeCents,
    profile.consultationFeeCents,
  );

  const followupCents = amountCents(
    fees.followup?.amountMinor,
    profile.followupFeeCents,
    profile.followUpFeeCents,
    standardCents > 0
      ? Math.round(standardCents * 0.75)
      : 0,
  );

  const standard = {
    feeCents: standardCents,
    currency: normalizeCurrency(
      fees.standard?.currency || baseCurrency,
    ),
    durationMin: standardDurationMin,
    bufferMin,
  };

  const followup = {
    feeCents: followupCents,
    currency: normalizeCurrency(
      fees.followup?.currency || baseCurrency,
    ),
    durationMin: followupDurationMin,
    bufferMin,
  };

  return {
    clinician,
    clinicianId: clinician.id,
    clinicianUserId,
    timezone,
    template: normalizeTemplate(
      scheduleResult.schedule.template,
    ),
    exceptions: normalizeExceptions(
      scheduleResult.schedule.exceptions,
    ),
    slotMin: '00:00',
    slotMax: '23:59',
    minAdvanceMinutes,
    maxAdvanceDays,
    standard,
    followup,
    selected:
      consultType === 'followup' ? followup : standard,
    scheduleMatchedUserId:
      scheduleResult.matchedUserId,
    sources: {
      scheduleSource: scheduleResult.source,
      consultSource: 'clinician_settings_consult',
      feeSource:
        fees.standard || fees.followup
          ? 'clinician_fee_engine'
          : 'clinician_profile_fee',
      bufferSource:
        storedConsult.bufferMinutes != null ||
        profile.bufferMinutes != null ||
        profile.bufferMin != null
          ? 'clinician_consult_meta_buffer'
          : 'admin_consult_policy_buffer',
    },
  };
}

export function isAvailabilityClinicianBookable(
  clinician: ClinicianRecord,
) {
  const status = String(
    clinician.status || '',
  )
    .trim()
    .toLowerCase();

  return Boolean(
    clinician &&
      !clinician.disabled &&
      !clinician.archived &&
      clinician.trainingCompleted !== false &&
      ['active', 'approved', 'verified'].includes(status),
  );
}

async function loadConflicts(args: {
  clinicianId: string;
  rangeStart: Date;
  rangeEnd: Date;
  excludeAppointmentId?: string | null;
}) {
  const where: Record<string, any> = {
    clinicianId: args.clinicianId,
    status: {
      in: ['scheduled', 'reserved', 'confirmed', 'pending'],
    },
    startsAt: { lt: args.rangeEnd },
    endsAt: { gt: args.rangeStart },
  };

  if (args.excludeAppointmentId) {
    where.id = { not: args.excludeAppointmentId };
  }

  return (prisma as any).appointment.findMany({
    where,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
    },
  });
}

function slotState(args: {
  start: Date;
  end: Date;
  conflicts: Array<{
    id?: string;
    startsAt: Date;
    endsAt: Date;
  }>;
  bufferMin: number;
  now: Date;
  canBook: boolean;
  enforceBookability: boolean;
  enforceAdvanceWindow: boolean;
  consultType: ConsultType;
  caseId: string | null;
  minAdvanceMinutes: number;
  maxAdvanceBoundary: Date;
}): {
  status: AvailabilitySlotStatus;
  reason?: string;
} {
  const bufferedStart = addMinutes(
    args.start,
    -args.bufferMin,
  );
  const bufferedEnd = addMinutes(
    args.end,
    args.bufferMin,
  );

  const clash = args.conflicts.some((conflict) =>
    overlaps(
      bufferedStart,
      bufferedEnd,
      conflict.startsAt,
      conflict.endsAt,
    ),
  );

  if (
    args.enforceAdvanceWindow &&
    args.end <= args.now
  ) {
    return {
      status: 'past',
      reason: 'This time has already passed.',
    };
  }

  if (
    args.enforceBookability &&
    !args.canBook
  ) {
    return {
      status: 'blocked',
      reason:
        'This clinician is not currently accepting bookings.',
    };
  }

  if (
    args.enforceAdvanceWindow &&
    args.start.getTime() <
      args.now.getTime() +
        args.minAdvanceMinutes * 60000
  ) {
    return {
      status: 'blocked',
      reason:
        `Requires at least ${args.minAdvanceMinutes} ` +
        'minutes advance notice.',
    };
  }

  if (
    args.enforceAdvanceWindow &&
    args.start > args.maxAdvanceBoundary
  ) {
    return {
      status: 'blocked',
      reason:
        'This time is outside the clinician advance booking window.',
    };
  }

  if (clash) {
    return {
      status: 'booked',
      reason: 'This time is already reserved or booked.',
    };
  }

  if (
    args.consultType === 'followup' &&
    !args.caseId
  ) {
    return {
      status: 'limited',
      reason:
        'Follow-up slots require an active case context.',
    };
  }

  return { status: 'available' };
}

export async function listAvailabilitySlots(args: {
  clinicianRef: string;
  from: string;
  days?: number;
  consultType?: unknown;
  caseId?: string | null;
  includeUnavailable?: boolean;
  enforceBookability?: boolean;
  enforceAdvanceWindow?: boolean;
  requestedStepMin?: number;
  now?: Date;
}) {
  const from = String(args.from || '').slice(0, 10);

  if (!isValidAvailabilityDate(from)) {
    throw new AvailabilityError(
      'invalid_from_date',
      400,
      { from },
    );
  }

  const consultType = normalizeConsultType(
    args.consultType,
  );
  const contract = await loadAvailabilityConfig(
    args.clinicianRef,
    consultType,
  );

  const requestedDays = Math.max(
    1,
    Math.min(
      62,
      Math.floor(Number(args.days || 14)),
    ),
  );

  const enforceAdvanceWindow =
    args.enforceAdvanceWindow !== false;

  const days = enforceAdvanceWindow
    ? Math.min(
        requestedDays,
        contract.maxAdvanceDays,
      )
    : requestedDays;

  const rangeEndYmd = addAvailabilityDays(
    from,
    days,
  );

  const rangeStartUtc = localDateTimeToUtc(
    from,
    '00:00',
    contract.timezone,
  );

  const rangeEndUtc = localDateTimeToUtc(
    rangeEndYmd,
    '00:00',
    contract.timezone,
  );

  const conflicts = await loadConflicts({
    clinicianId: contract.clinicianId,
    rangeStart: rangeStartUtc,
    rangeEnd: rangeEndUtc,
  });

  const now = args.now || new Date();
  const maxAdvanceBoundary = addMinutes(
    now,
    contract.maxAdvanceDays * 24 * 60,
  );

  const requestedStepMin = Math.max(
    0,
    Math.floor(Number(args.requestedStepMin || 0)),
  );

  const generatedStepMin = Math.max(
    5,
    contract.selected.durationMin +
      contract.selected.bufferMin,
    requestedStepMin,
  );

  const canBook = isAvailabilityClinicianBookable(
    contract.clinician,
  );

  const enforceBookability =
    args.enforceBookability !== false;

  const slots: AvailabilitySlot[] = [];

  for (let index = 0; index < days; index += 1) {
    const ymd = addAvailabilityDays(from, index);

    if (
      contract.exceptions.some(
        (exception) => exception.date === ymd,
      )
    ) {
      continue;
    }

    const day = contract.template[weekdayKey(ymd)];

    if (
      !day?.enabled ||
      !Array.isArray(day.ranges) ||
      day.ranges.length === 0
    ) {
      continue;
    }

    for (const range of day.ranges) {
      const startHhmm = normalizeHhmm(
        range.start,
        '09:00',
      );
      const endHhmm = normalizeHhmm(
        range.end,
        '17:00',
      );

      const startMin = hhmmMinutes(startHhmm);
      const endMin = hhmmMinutes(endHhmm);
      const crossesMidnight = endMin <= startMin;

      const rangeStart = localDateTimeToUtc(
        ymd,
        startHhmm,
        contract.timezone,
      );

      const rangeEnd = localDateTimeToUtc(
        crossesMidnight
          ? addAvailabilityDays(ymd, 1)
          : ymd,
        endHhmm,
        contract.timezone,
      );

      for (
        let cursor = rangeStart.getTime();
        cursor < rangeEnd.getTime();
        cursor += generatedStepMin * 60000
      ) {
        const start = new Date(cursor);
        const end = addMinutes(
          start,
          contract.selected.durationMin,
        );

        if (end > rangeEnd) {
          continue;
        }

        const state = slotState({
          start,
          end,
          conflicts,
          bufferMin:
            contract.selected.bufferMin,
          now,
          canBook,
          enforceBookability,
          enforceAdvanceWindow,
          consultType,
          caseId: args.caseId || null,
          minAdvanceMinutes:
            contract.minAdvanceMinutes,
          maxAdvanceBoundary,
        });

        if (
          !args.includeUnavailable &&
          !['available', 'limited'].includes(
            state.status,
          )
        ) {
          continue;
        }

        const display = localSlotDisplay(
          start,
          end,
          contract.timezone,
        );

        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          ...display,
          status: state.status,
          ...(state.reason
            ? { reason: state.reason }
            : {}),
          consultType,
          feeCents:
            contract.selected.feeCents,
          currency:
            contract.selected.currency,
          durationMin:
            contract.selected.durationMin,
          bufferMin:
            contract.selected.bufferMin,
        });
      }
    }
  }

  return {
    slots,
    contract,
    meta: {
      clinicianId: contract.clinicianId,
      clinicianUserId:
        contract.clinicianUserId,
      from,
      rangeEnd: rangeEndYmd,
      days,
      requestedDays,
      generatedStepMin,
      includeUnavailable:
        Boolean(args.includeUnavailable),
      consultType,
      caseId: args.caseId || null,
      timezone: contract.timezone,
      slotMin: contract.slotMin,
      slotMax: contract.slotMax,
      minAdvanceMinutes:
        contract.minAdvanceMinutes,
      maxAdvanceDays:
        contract.maxAdvanceDays,
      standard: contract.standard,
      followup: contract.followup,
      schedule: {
        templateDays: Object.entries(
          contract.template,
        )
          .filter(([, value]) => value?.enabled)
          .map(([key]) => key),
        windows: Object.fromEntries(
          Object.entries(contract.template)
            .filter(([, value]) => value?.enabled)
            .map(([key, value]) => [
              key,
              value?.ranges || [],
            ]),
        ),
        exceptionsCount:
          contract.exceptions.length,
        matched: Boolean(
          contract.scheduleMatchedUserId,
        ),
        matchedUserId:
          contract.scheduleMatchedUserId,
      },
      sources: contract.sources,
    },
  };
}

function findContainingRange(args: {
  contract: AvailabilityContract;
  startsAt: Date;
  endsAt: Date;
}) {
  const local = localPartsInTimeZone(
    args.startsAt,
    args.contract.timezone,
  );

  const ymd = local.ymd;

  if (
    args.contract.exceptions.some(
      (exception) => exception.date === ymd,
    )
  ) {
    return null;
  }

  const day =
    args.contract.template[weekdayKey(ymd)];

  if (
    !day?.enabled ||
    !Array.isArray(day.ranges)
  ) {
    return null;
  }

  for (const range of day.ranges) {
    const startHhmm = normalizeHhmm(
      range.start,
      '09:00',
    );
    const endHhmm = normalizeHhmm(
      range.end,
      '17:00',
    );

    const crossesMidnight =
      hhmmMinutes(endHhmm) <=
      hhmmMinutes(startHhmm);

    const rangeStart = localDateTimeToUtc(
      ymd,
      startHhmm,
      args.contract.timezone,
    );

    const rangeEnd = localDateTimeToUtc(
      crossesMidnight
        ? addAvailabilityDays(ymd, 1)
        : ymd,
      endHhmm,
      args.contract.timezone,
    );

    if (
      args.startsAt >= rangeStart &&
      args.endsAt <= rangeEnd
    ) {
      return {
        ymd,
        rangeStart,
        rangeEnd,
      };
    }
  }

  return null;
}

export async function validateAvailabilityInterval(
  args: {
    clinicianRef: string;
    startsAt: Date;
    endsAt: Date;
    consultType?: unknown;
    caseId?: string | null;
    allowExtendedDuration?: boolean;
    excludeAppointmentId?: string | null;
    enforceBookability?: boolean;
    enforceAdvanceWindow?: boolean;
    enforceConflicts?: boolean;
    now?: Date;
  },
) {
  if (
    !(args.startsAt instanceof Date) ||
    !(args.endsAt instanceof Date) ||
    !Number.isFinite(args.startsAt.getTime()) ||
    !Number.isFinite(args.endsAt.getTime()) ||
    args.endsAt <= args.startsAt
  ) {
    throw new AvailabilityError(
      'invalid_time_range',
      400,
    );
  }

  const consultType = normalizeConsultType(
    args.consultType,
  );

  const contract = await loadAvailabilityConfig(
    args.clinicianRef,
    consultType,
  );

  const containingRange = findContainingRange({
    contract,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
  });

  if (!containingRange) {
    throw new AvailabilityError(
      'interval_outside_clinician_availability',
      409,
      {
        startsAt: args.startsAt.toISOString(),
        endsAt: args.endsAt.toISOString(),
      },
    );
  }

  const canonicalDurationMin =
    contract.selected.durationMin;

  if (!args.allowExtendedDuration) {
    const expectedEnd = addMinutes(
      args.startsAt,
      canonicalDurationMin,
    );

    if (
      expectedEnd.getTime() !==
      args.endsAt.getTime()
    ) {
      throw new AvailabilityError(
        'interval_duration_not_canonical',
        409,
        {
          expectedDurationMin:
            canonicalDurationMin,
          expectedEnd:
            expectedEnd.toISOString(),
          receivedEnd:
            args.endsAt.toISOString(),
        },
      );
    }
  }

  const canonicalStepMin = Math.max(
    5,
    contract.selected.durationMin +
      contract.selected.bufferMin,
  );

  const offsetMs =
    args.startsAt.getTime() -
    containingRange.rangeStart.getTime();

  if (
    offsetMs < 0 ||
    offsetMs % (canonicalStepMin * 60000) !== 0
  ) {
    throw new AvailabilityError(
      'interval_start_not_canonical_slot',
      409,
      {
        startsAt: args.startsAt.toISOString(),
        canonicalStepMin,
      },
    );
  }

  const conflicts =
    args.enforceConflicts === false
      ? []
      : await loadConflicts({
          clinicianId: contract.clinicianId,
          rangeStart: addMinutes(
            args.startsAt,
            -contract.selected.bufferMin,
          ),
          rangeEnd: addMinutes(
            args.endsAt,
            contract.selected.bufferMin,
          ),
          excludeAppointmentId:
            args.excludeAppointmentId || null,
        });

  const now = args.now || new Date();
  const maxAdvanceBoundary = addMinutes(
    now,
    contract.maxAdvanceDays * 24 * 60,
  );

  const state = slotState({
    start: args.startsAt,
    end: args.endsAt,
    conflicts,
    bufferMin: contract.selected.bufferMin,
    now,
    canBook:
      isAvailabilityClinicianBookable(
        contract.clinician,
      ),
    enforceBookability:
      args.enforceBookability !== false,
    enforceAdvanceWindow:
      args.enforceAdvanceWindow !== false,
    consultType,
    caseId: args.caseId || null,
    minAdvanceMinutes:
      contract.minAdvanceMinutes,
    maxAdvanceBoundary,
  });

  if (
    !['available', 'limited'].includes(
      state.status,
    )
  ) {
    throw new AvailabilityError(
      'interval_not_bookable',
      409,
      {
        status: state.status,
        reason: state.reason,
      },
    );
  }

  const display = localSlotDisplay(
    args.startsAt,
    args.endsAt,
    contract.timezone,
  );

  return {
    ok: true,
    status: state.status,
    reason: state.reason,
    consultType,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    ...display,
    durationMin: Math.round(
      (args.endsAt.getTime() -
        args.startsAt.getTime()) /
        60000,
    ),
    canonicalDurationMin,
    bufferMin: contract.selected.bufferMin,
    feeCents: contract.selected.feeCents,
    currency: contract.selected.currency,
    contract,
  };
}