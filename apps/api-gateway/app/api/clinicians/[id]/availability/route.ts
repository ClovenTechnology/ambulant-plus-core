// apps/api-gateway/app/api/clinicians/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConsultType = 'standard' | 'followup';
type SlotStatus = 'available' | 'limited' | 'blocked' | 'booked' | 'past';

type Slot = {
  start: string;
  end: string;
  status: SlotStatus;
  reason?: string;
  consultType: ConsultType;
  feeCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
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

function hhmmToUtcOnDay(day: Date, hhmm: string) {
  const [hhRaw, mmRaw] = hhmm.split(':').map(Number);
  const hh = Number.isFinite(hhRaw) ? hhRaw : 8;
  const mm = Number.isFinite(mmRaw) ? mmRaw : 0;

  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
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

function buildFeeProfile(clinician: any, consultType: ConsultType) {
  const { profile } = readProfileJson(clinician);
  const currency = normalizeCurrency(clinician?.currency || profile?.currency || 'ZAR');

  const standardCents = amountCents(
    clinician?.feeCents,
    profile?.feeCents,
    profile?.standardFeeCents,
    profile?.standardConsultFeeCents,
    profile?.consultationFeeCents,
  );

  const followUpCents = amountCents(
    profile?.followUpFeeCents,
    profile?.followupFeeCents,
    standardCents > 0 ? Math.round(standardCents * 0.75) : 0,
  );

  const standardDurationMin = Math.max(
    1,
    Math.round(num(profile?.durationMin ?? profile?.standardDurationMin, 30)),
  );
  const followUpDurationMin = Math.max(
    1,
    Math.round(num(profile?.followUpDurationMin ?? profile?.followupDurationMin, 15)),
  );

  const standardBufferMin = Math.max(0, Math.round(num(profile?.bufferMin, 0)));
  const followUpBufferMin = Math.max(
    0,
    Math.round(num(profile?.followUpBufferMin ?? profile?.followupBufferMin, standardBufferMin)),
  );

  if (consultType === 'followup') {
    return {
      feeCents: followUpCents,
      currency,
      durationMin: followUpDurationMin,
      bufferMin: followUpBufferMin,
    };
  }

  return {
    feeCents: standardCents,
    currency,
    durationMin: standardDurationMin,
    bufferMin: standardBufferMin,
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

  if (clash) {
    return { status: 'booked', reason: 'This time is already reserved or booked.' };
  }

  if (args.consultType === 'followup' && !args.caseId) {
    return { status: 'limited', reason: 'Follow-up slots require an active case context.' };
  }

  const startsInMinutes = Math.round((args.start.getTime() - args.now.getTime()) / 60000);
  if (startsInMinutes >= 0 && startsInMinutes < 120) {
    return { status: 'limited', reason: 'Starts soon. Complete checkout promptly to secure this slot.' };
  }

  return { status: 'available' };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestedId = decodeURIComponent(String(params.id || '')).trim();
    if (!requestedId) return json({ ok: false, error: 'clinician_id_required', slots: [] }, 400);

    const u = new URL(req.url);
    const days = clampInt(u.searchParams.get('days'), 14, 1, 30);
    const tileMinutes = clampInt(u.searchParams.get('slot'), 30, 10, 120);
    const fromStr = u.searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const includeUnavailable =
      u.searchParams.get('includeUnavailable') === '1' ||
      u.searchParams.get('includeUnavailable') === 'true';

    const consultType = normalizeConsultType(
      u.searchParams.get('consultType') || u.searchParams.get('type') || u.searchParams.get('kind'),
    );
    const caseId = String(u.searchParams.get('caseId') || '').trim() || null;

    const from = new Date(`${fromStr}T00:00:00.000Z`);
    if (!Number.isFinite(from.getTime())) {
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
        meta: true,
      },
    });

    if (!clinician) {
      return json({ ok: false, error: 'unknown_clinician', slots: [] }, 404);
    }

    const fee = buildFeeProfile(clinician, consultType);
    const canBook = isClinicianBookable(clinician);

    const rangeEnd = new Date(from.getTime() + days * 86400000);

    const conflicts = await (prisma as any).appointment.findMany({
      where: {
        clinicianId: clinician.id,
        status: { in: ['scheduled', 'reserved', 'confirmed', 'pending'] },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    });

    const min = String(u.searchParams.get('min') || '08:00').slice(0, 5);
    const max = String(u.searchParams.get('max') || '17:00').slice(0, 5);
    const now = new Date();

    const slots: Slot[] = [];

    for (let i = 0; i < days; i += 1) {
      const day = new Date(from.getTime() + i * 86400000);
      const dayStart = hhmmToUtcOnDay(day, min);
      const dayEnd = hhmmToUtcOnDay(day, max);

      for (let t = dayStart.getTime(); t < dayEnd.getTime(); t += tileMinutes * 60000) {
        const start = new Date(t);
        const end = addMinutes(start, fee.durationMin);

        if (end > dayEnd) continue;

        const state = slotState({
          start,
          end,
          conflicts,
          bufferMin: fee.bufferMin,
          now,
          canBook,
          consultType,
          caseId,
        });

        if (!includeUnavailable && !['available', 'limited'].includes(state.status)) {
          continue;
        }

        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
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

    return json({
      ok: true,
      slots,
      meta: {
        source: 'api_gateway_clinician_availability_v2',
        clinicianId: clinician.id,
        requestedId,
        from: from.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        days,
        tileMinutes,
        includeUnavailable,
        consultType,
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
