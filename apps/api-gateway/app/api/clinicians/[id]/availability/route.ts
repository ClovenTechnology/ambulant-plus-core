// apps/api-gateway/app/api/clinicians/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getAdminPolicy, getClinicianConsult } from '@/src/store/consult';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConsultType = 'standard' | 'followup';
type SlotStatus = 'available' | 'limited' | 'blocked' | 'booked' | 'past';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type Slot = {
  start: string;
  end: string;
  localStart?: string;
  localEnd?: string;
  localDate?: string;
  localStartTime?: string;
  localEndTime?: string;
  localTimeLabel?: string;
  timezone?: string;
  status: SlotStatus;
  reason?: string;
  consultType: ConsultType;
  feeCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
};

type SlotRange = { start: string; end: string };
type DayTemplate = { enabled?: boolean; ranges?: SlotRange[] };

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DEFAULT_TEMPLATE: Record<DayKey, DayTemplate> = {
  mon: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  tue: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  wed: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  thu: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  fri: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  sat: { enabled: false, ranges: [{ start: '09:00', end: '12:00' }] },
  sun: { enabled: false, ranges: [] },
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeParseJson(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function amountCents(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }

  return 0;
}

function normalizeCurrency(value: unknown) {
  const c = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'ZAR';
}

function normalizeConsultType(value: unknown): ConsultType {
  const s = String(value || '').trim().toLowerCase();
  return s === 'followup' || s === 'follow-up' ? 'followup' : 'standard';
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1 + days));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isValidYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime());
}

function weekdayKey(ymd: string): DayKey {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return DAY_KEYS[d.getUTCDay()] || 'mon';
}

function hhmmMinutes(hhmm: unknown) {
  const [hRaw, mRaw] = String(hhmm || '00:00').slice(0, 5).split(':').map(Number);
  const h = Number.isFinite(hRaw) ? hRaw : 0;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

function normalizeHhmm(value: unknown, fallback: string) {
  const s = String(value || '').slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback;
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
      if (part.type !== 'literal') bag[part.type] = part.value;
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

function localDateTimeToUtc(ymd: string, hhmm: string, timeZone: string) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = normalizeHhmm(hhmm, '00:00').split(':').map(Number);

  const assumedUtc = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0));
  let offset = getOffsetMinutes(timeZone, assumedUtc);
  let utc = new Date(assumedUtc.getTime() - offset * 60000);

  const refinedOffset = getOffsetMinutes(timeZone, utc);
  if (refinedOffset !== offset) {
    utc = new Date(assumedUtc.getTime() - refinedOffset * 60000);
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
    if (part.type !== 'literal') bag[part.type] = part.value;
  }

  return {
    ymd: `${bag.year}-${bag.month}-${bag.day}`,
    hhmm: `${bag.hour}:${bag.minute}`,
  };
}

function localSlotDisplay(start: Date, end: Date, timeZone: string) {
  const s = localPartsInTimeZone(start, timeZone);
  const e = localPartsInTimeZone(end, timeZone);

  return {
    localStart: `${s.ymd}T${s.hhmm}`,
    localEnd: `${e.ymd}T${e.hhmm}`,
    localDate: s.ymd,
    localStartTime: s.hhmm,
    localEndTime: e.hhmm,
    localTimeLabel: `${s.hhmm} - ${e.hhmm}`,
    timezone: timeZone,
  };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function readProfileJson(clinician: any) {
  const meta = safeParseJson(clinician?.meta);
  const rawProfileJson = safeParseJson(meta.rawProfileJson);
  const rawProfile = safeParseJson(meta.rawProfile);
  const submittedProfile = safeParseJson(meta.submittedProfile);

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

function normalizeTemplate(template: any): Record<DayKey, DayTemplate> {
  const parsed = safeParseJson(template);
  const out: Record<DayKey, DayTemplate> = { ...DEFAULT_TEMPLATE };

  for (const day of Object.keys(DEFAULT_TEMPLATE) as DayKey[]) {
    const raw = parsed?.[day];

    if (!raw || typeof raw !== 'object') {
      out[day] = DEFAULT_TEMPLATE[day];
      continue;
    }

    const ranges = Array.isArray(raw.ranges)
      ? raw.ranges
          .map((r: any) => ({
            start: normalizeHhmm(r?.start, '09:00'),
            end: normalizeHhmm(r?.end, '17:00'),
          }))
          .filter((r: SlotRange) => r.start && r.end)
      : [];

    out[day] = {
      enabled: raw.enabled !== false,
      ranges,
    };
  }

  return out;
}

function normalizeExceptions(value: any): Array<{ date: string; reason?: string }> {
  const parsed = safeParseJson(value);
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(value) ? value : [];

  return arr
    .map((x: any) => {
      const reason = cleanStr(x?.reason);
      return {
        date: String(x?.date || x || '').slice(0, 10),
        ...(reason ? { reason } : {}),
      };
    })
    .filter((x) => isValidYmd(x.date));
}

function isExceptionDate(exceptions: Array<{ date: string }>, ymd: string) {
  return exceptions.some((x) => x.date === ymd);
}

function clinicianIdentityKeys(clinician: any) {
  return Array.from(
    new Set(
      [
        clinician?.userId,
        clinician?.id,
        clinician?.email,
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean),
    ),
  );
}

async function getScheduleForClinician(clinician: any) {
  const keys = clinicianIdentityKeys(clinician);

  if (!keys.length) {
    return {
      schedule: {
        country: 'ZA',
        timezone: 'Africa/Johannesburg',
        template: DEFAULT_TEMPLATE,
        exceptions: [],
        slotMin: '00:00',
        slotMax: '23:59',
      },
      source: 'fallback_default_schedule',
      matchedUserId: null,
    };
  }

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

    const preferred = clinicianIdentityKeys({
      userId: clinician?.userId,
      email: clinician?.email,
      id: clinician?.id,
    });

    const row = rows
      .slice()
      .sort((a: any, b: any) => preferred.indexOf(a.userId) - preferred.indexOf(b.userId))[0];

    if (!row) {
      return {
        schedule: {
          country: 'ZA',
          timezone: 'Africa/Johannesburg',
          template: DEFAULT_TEMPLATE,
          exceptions: [],
          slotMin: '00:00',
          slotMax: '23:59',
        },
        source: 'fallback_default_schedule',
        matchedUserId: null,
      };
    }

    return {
      schedule: {
        country: cleanStr(row.country) || 'ZA',
        timezone: cleanStr(row.timezone) || 'Africa/Johannesburg',
        template: safeParseJson(row.template),
        exceptions: safeParseJson(row.exceptions),
        slotMin: '00:00',
        slotMax: '23:59',
      },
      source: 'clinician_settings_schedule',
      matchedUserId: row.userId || null,
    };
  } catch (err: any) {
    console.error('[api-gateway] clinician schedule lookup failed; using default schedule', err);
    return {
      schedule: {
        country: 'ZA',
        timezone: 'Africa/Johannesburg',
        template: DEFAULT_TEMPLATE,
        exceptions: [],
        slotMin: '00:00',
        slotMax: '23:59',
      },
      source: 'fallback_default_schedule',
      matchedUserId: null,
    };
  }
}

async function getActiveFees(clinician: any) {
  try {
    const rows = await (prisma as any).clinicianFee.findMany({
      where: {
        clinicianUserId: clinician.userId || clinician.id,
        active: true,
        kind: { in: ['STANDARD', 'FOLLOWUP'] },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      select: {
        kind: true,
        currency: true,
        amountMinor: true,
      },
    });

    const standard = rows.find((r: any) => String(r.kind).toUpperCase() === 'STANDARD');
    const followup = rows.find((r: any) => String(r.kind).toUpperCase() === 'FOLLOWUP');

    return { standard, followup };
  } catch {
    return { standard: null, followup: null };
  }
}

async function buildAvailabilityContract(clinician: any, consultType: ConsultType) {
  const { profile } = readProfileJson(clinician);

  const userId = clinician.userId || clinician.id;

  const [scheduleResult, adminPolicy, consultSettings, fees] = await Promise.all([
    getScheduleForClinician(clinician),
    getAdminPolicy().catch(() => null),
    getClinicianConsult(userId).catch(() => null),
    getActiveFees(clinician),
  ]);

  const schedule: Record<string, any> =
    scheduleResult?.schedule && typeof scheduleResult.schedule === 'object'
      ? (scheduleResult.schedule as Record<string, any>)
      : {};
  const timezone =
    cleanStr(schedule.timezone) ||
    cleanStr(profile.timezone) ||
    'Africa/Johannesburg';

  const template = normalizeTemplate(schedule.template);
  const exceptions = normalizeExceptions(schedule.exceptions);

  const adminBuffer = Math.max(0, Math.round(num(adminPolicy?.bufferAfterMinutes, 5)));

  const storedConsult = safeParseJson(profile.consultSettings);
  const profileBuffer = num(storedConsult.bufferMinutes ?? profile.bufferMinutes ?? profile.bufferMin, adminBuffer);

  const standardDurationMin = Math.max(
    1,
    Math.round(
      num(
        consultSettings?.defaultStandardMin ??
          storedConsult.defaultStandardMin ??
          storedConsult.defaultMinutes ??
          profile.defaultStandardMin ??
          profile.durationMin ??
          profile.standardDurationMin,
        30,
      ),
    ),
  );

  const followupDurationMin = Math.max(
    1,
    Math.round(
      num(
        consultSettings?.defaultFollowupMin ??
          storedConsult.defaultFollowupMin ??
          storedConsult.followupMinutes ??
          profile.defaultFollowupMin ??
          profile.followUpDurationMin ??
          profile.followupDurationMin,
        15,
      ),
    ),
  );

  const bufferMin = Math.max(0, Math.round(profileBuffer));

  const minAdvanceMinutes = Math.max(
    0,
    Math.round(num(consultSettings?.minAdvanceMinutes ?? storedConsult.minAdvanceMinutes ?? profile.minAdvanceMinutes, 30)),
  );

  const maxAdvanceDays = Math.max(
    1,
    Math.round(num(consultSettings?.maxAdvanceDays ?? storedConsult.maxAdvanceDays ?? profile.maxAdvanceDays, 30)),
  );

  const baseCurrency = normalizeCurrency(
    fees.standard?.currency || fees.followup?.currency || clinician.currency || profile.currency || 'ZAR',
  );

  const standardCents = amountCents(
    fees.standard?.amountMinor,
    clinician?.feeCents,
    profile?.feeCents,
    profile?.standardFeeCents,
    profile?.standardConsultFeeCents,
    profile?.consultationFeeCents,
  );

  const followupCents = amountCents(
    fees.followup?.amountMinor,
    profile?.followupFeeCents,
    profile?.followUpFeeCents,
    standardCents > 0 ? Math.round(standardCents * 0.75) : 0,
  );

  const selected =
    consultType === 'followup'
      ? {
          feeCents: followupCents,
          currency: normalizeCurrency(fees.followup?.currency || baseCurrency),
          durationMin: followupDurationMin,
          bufferMin,
        }
      : {
          feeCents: standardCents,
          currency: normalizeCurrency(fees.standard?.currency || baseCurrency),
          durationMin: standardDurationMin,
          bufferMin,
        };

  return {
    userId,
    timezone,
    template,
    exceptions,
    slotMin: normalizeHhmm(schedule.slotMin, '00:00'),
    slotMax: normalizeHhmm(schedule.slotMax, '23:59'),
    minAdvanceMinutes,
    maxAdvanceDays,
    standard: {
      feeCents: standardCents,
      currency: normalizeCurrency(fees.standard?.currency || baseCurrency),
      durationMin: standardDurationMin,
      bufferMin,
    },
    followup: {
      feeCents: followupCents,
      currency: normalizeCurrency(fees.followup?.currency || baseCurrency),
      durationMin: followupDurationMin,
      bufferMin,
    },
    selected,
    scheduleMatchedUserId: scheduleResult?.matchedUserId || null,
    sources: {
      scheduleSource: scheduleResult?.source || 'fallback_default_schedule',
      consultSource: consultSettings ? 'clinician_settings_consult' : 'profile_or_default_consult',
      feeSource: fees.standard || fees.followup ? 'clinician_fee_engine' : 'clinician_profile_fee',
      bufferSource:
        storedConsult.bufferMinutes != null || profile.bufferMinutes != null || profile.bufferMin != null
          ? 'clinician_consult_meta_buffer'
          : 'admin_consult_policy_buffer',
    },
  };
}

function isClinicianBookable(clinician: any) {
  const status = String(clinician?.status || '').trim().toLowerCase();

  return Boolean(
    clinician &&
      !clinician.disabled &&
      !clinician.archived &&
      clinician.trainingCompleted !== false &&
      ['active', 'approved', 'verified'].includes(status),
  );
}

function slotState(args: {
  start: Date;
  end: Date;
  conflicts: Array<{ startsAt: Date; endsAt: Date }>;
  bufferMin: number;
  now: Date;
  canBook: boolean;
  consultType: ConsultType;
  caseId: string | null;
  minAdvanceMinutes: number;
  maxAdvanceBoundary: Date;
}): { status: SlotStatus; reason?: string } {
  const bufferedStart = addMinutes(args.start, -args.bufferMin);
  const bufferedEnd = addMinutes(args.end, args.bufferMin);
  const clash = args.conflicts.some((c) => overlaps(bufferedStart, bufferedEnd, c.startsAt, c.endsAt));

  if (args.end <= args.now) {
    return { status: 'past', reason: 'This time has already passed.' };
  }

  if (!args.canBook) {
    return { status: 'blocked', reason: 'This clinician is not currently accepting bookings.' };
  }

  if (args.start.getTime() < args.now.getTime() + args.minAdvanceMinutes * 60000) {
    return { status: 'blocked', reason: `Requires at least ${args.minAdvanceMinutes} minutes advance notice.` };
  }

  if (args.start > args.maxAdvanceBoundary) {
    return { status: 'blocked', reason: 'This time is outside the clinician advance booking window.' };
  }

  if (clash) {
    return { status: 'booked', reason: 'This time is already reserved or booked.' };
  }

  if (args.consultType === 'followup' && !args.caseId) {
    return { status: 'limited', reason: 'Follow-up slots require an active case context.' };
  }

  return { status: 'available' };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestedId = decodeURIComponent(String(params.id || '')).trim();
    if (!requestedId) return json({ ok: false, error: 'clinician_id_required', slots: [] }, 400);

    const u = new URL(req.url);

    const requestedDays = clampInt(u.searchParams.get('days'), 14, 1, 60);
    const fromStr = u.searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const includeUnavailable =
      u.searchParams.get('includeUnavailable') === '1' ||
      u.searchParams.get('includeUnavailable') === 'true';

    const consultType = normalizeConsultType(
      u.searchParams.get('consultType') || u.searchParams.get('type') || u.searchParams.get('kind'),
    );
    const caseId = String(u.searchParams.get('caseId') || '').trim() || null;

    if (!isValidYmd(fromStr)) {
      return json({ ok: false, error: 'invalid_from_date', slots: [] }, 400);
    }

    const clinician = await (prisma as any).clinicianProfile.findFirst({
      where: {
        OR: [{ id: requestedId }, { userId: requestedId }],
      },
      select: {
        id: true,
        userId: true,
        status: true,
        disabled: true,
        archived: true,
        trainingCompleted: true,
        feeCents: true,
        currency: true,
        email: true,
        meta: true,
      },
    });

    if (!clinician) {
      return json({ ok: false, error: 'unknown_clinician', slots: [] }, 404);
    }

    const contract = await buildAvailabilityContract(clinician, consultType);
    const fee = contract.selected;
    const canBook = isClinicianBookable(clinician);

    const days = Math.min(requestedDays, contract.maxAdvanceDays);
    const rangeEndYmd = addDaysYmd(fromStr, days);
    const rangeStartUtc = localDateTimeToUtc(fromStr, '00:00', contract.timezone);
    const rangeEndUtc = localDateTimeToUtc(rangeEndYmd, '00:00', contract.timezone);

    const conflicts = await (prisma as any).appointment.findMany({
      where: {
        clinicianId: clinician.id,
        status: { in: ['scheduled', 'reserved', 'confirmed', 'pending'] },
        startsAt: { lt: rangeEndUtc },
        endsAt: { gt: rangeStartUtc },
      },
      select: { startsAt: true, endsAt: true },
    });

    const now = new Date();
    const maxAdvanceBoundary = addMinutes(now, contract.maxAdvanceDays * 24 * 60);

    const requestedTile = clampInt(u.searchParams.get('slot'), 0, 0, 240);
    const generatedStepMin = Math.max(
      5,
      requestedTile > 0 ? requestedTile : fee.durationMin + fee.bufferMin,
    );

    const slots: Slot[] = [];

    for (let i = 0; i < days; i += 1) {
      const ymd = addDaysYmd(fromStr, i);

      if (isExceptionDate(contract.exceptions, ymd)) {
        continue;
      }

      const day = contract.template[weekdayKey(ymd)];
      if (!day?.enabled || !Array.isArray(day.ranges) || day.ranges.length === 0) {
        continue;
      }

      for (const range of day.ranges) {
        const startHhmm = normalizeHhmm(range.start, '09:00');
        const endHhmm = normalizeHhmm(range.end, '17:00');

        const startMin = hhmmMinutes(startHhmm);
        const endMin = hhmmMinutes(endHhmm);
        const crossesMidnight = endMin <= startMin;

        const rangeStart = localDateTimeToUtc(ymd, startHhmm, contract.timezone);
        const rangeEnd = localDateTimeToUtc(crossesMidnight ? addDaysYmd(ymd, 1) : ymd, endHhmm, contract.timezone);

        for (let t = rangeStart.getTime(); t < rangeEnd.getTime(); t += generatedStepMin * 60000) {
          const start = new Date(t);
          const end = addMinutes(start, fee.durationMin);

          if (end > rangeEnd) continue;

          const state = slotState({
            start,
            end,
            conflicts,
            bufferMin: fee.bufferMin,
            now,
            canBook,
            consultType,
            caseId,
            minAdvanceMinutes: contract.minAdvanceMinutes,
            maxAdvanceBoundary,
          });

          if (!includeUnavailable && !['available', 'limited'].includes(state.status)) {
            continue;
          }

          const display = localSlotDisplay(start, end, contract.timezone);

          slots.push({
            start: start.toISOString(),
            end: end.toISOString(),
            localStart: display.localStart,
            localEnd: display.localEnd,
            localDate: display.localDate,
            localStartTime: display.localStartTime,
            localEndTime: display.localEndTime,
            localTimeLabel: display.localTimeLabel,
            timezone: display.timezone,
            status: state.status,
            reason: state.reason,
            consultType,
            feeCents: fee.feeCents,
            currency: fee.currency,
            durationMin: fee.durationMin,
            bufferMin: fee.bufferMin,
          });
        }
      }
    }

    return json({
      ok: true,
      slots,
      meta: {
        source: 'api_gateway_clinician_availability_v3',
        clinicianId: clinician.id,
        clinicianUserId: clinician.userId,
        requestedId,
        from: fromStr,
        rangeEnd: rangeEndYmd,
        days,
        requestedDays,
        generatedStepMin,
        includeUnavailable,
        consultType,
        caseId,
        timezone: contract.timezone,
        slotMin: contract.slotMin,
        slotMax: contract.slotMax,
        minAdvanceMinutes: contract.minAdvanceMinutes,
        maxAdvanceDays: contract.maxAdvanceDays,
        standard: contract.standard,
        followup: contract.followup,
        schedule: {
          templateDays: Object.entries(contract.template)
            .filter(([, value]) => value?.enabled)
            .map(([key]) => key),
          windows: Object.fromEntries(
            Object.entries(contract.template)
              .filter(([, value]) => value?.enabled)
              .map(([key, value]) => [key, value?.ranges || []]),
          ),
          exceptionsCount: contract.exceptions.length,
          matched: Boolean(contract.scheduleMatchedUserId),
          matchedUserId: contract.scheduleMatchedUserId,
        },
        sources: contract.sources,
        statusLegend: {
          available: 'Bookable now',
          limited: 'Bookable with a time or pathway warning',
          blocked: 'Not bookable because of clinician or rule state',
          booked: 'Already reserved or booked',
          past: 'Elapsed time',
        },
      },
    });
  } catch (err: any) {
    console.error('[api-gateway] clinician availability failed', err);
    return json(
      { ok: false, error: 'availability_failed', detail: String(err?.message || err), slots: [] },
      500,
    );
  }
}
