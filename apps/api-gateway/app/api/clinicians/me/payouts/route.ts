// apps/api-gateway/app/api/clinicians/me/payouts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { buildMetaForSave, readProfileJson } from '@/src/lib/meta-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payoutsPath = path.join(
  process.cwd(),
  '../../packages/admin/payouts.json',
);

/* ---------- Types for tax config ---------- */

type TaxBracketCfg = {
  minGrossCents?: number;
  maxGrossCents?: number | null;
  ratePercent: number;
};

type ClassTaxOverrideCfg = {
  classId: string;
  ratePercent: number;
};

type LabourTaxOverrideCfg = {
  labourCode: string;
  ratePercent: number;
};

type ClinicianTaxRules = {
  defaultRatePercent?: number;
  brackets?: TaxBracketCfg[];
  classOverrides?: ClassTaxOverrideCfg[];
  labourSectorOverrides?: LabourTaxOverrideCfg[];
};

type FundingSource = 'card' | 'medical_aid' | 'voucher' | 'unknown';

type PayoutStatus =
  | 'paid'
  | 'awaiting_scheme'
  | 'voucher_pool'
  | 'unpaid';

/* ---------- Read payout + tax settings from JSON ---------- */

async function readPayoutSettings(): Promise<{
  clinicianPercent: number;
  platformPercent: number;
  taxRules: ClinicianTaxRules | null;
}> {
  try {
    const raw = await fs.readFile(payoutsPath, 'utf-8');
    const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const json = JSON.parse(clean);

    const pct = Number(json.clinicianConsultPayoutPercent ?? 70);
    const safePct = Math.max(0, Math.min(100, pct));

    const taxRules: ClinicianTaxRules | null = json.clinicianTax || null;

    return {
      clinicianPercent: safePct,
      platformPercent: 100 - safePct,
      taxRules,
    };
  } catch {
    return {
      clinicianPercent: 70,
      platformPercent: 30,
      taxRules: null,
    };
  }
}

/* ---------- Date helpers ---------- */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // Sun=0
  const dff = (day + 6) % 7; // make Monday=0
  x.setDate(x.getDate() - dff);
  return x;
}

/* ---------- Clinician helpers ---------- */

async function getCurrentClinician(req: NextRequest) {
  const who = readIdentity(req.headers);
  const uid = String((who as any)?.uid || '');

  if (who.role !== 'clinician' || !uid) return null;

  const clinician = await prisma.clinicianProfile.findUnique({
    where: { userId: uid },
  });

  if (!clinician) return null;

  return {
    clinician,
    who: {
      ...who,
      uid,
    },
  };
}

/* ---------- Staff compensation extraction ---------- */

function extractStaffCompFromProfile(clinician: unknown): {
  percentRevenueTotalPercent: number;
  flatMonthlyNominalCents: number;
} {
  const j = readProfileJson(clinician);
  const staffArr: unknown[] = Array.isArray(j.adminStaff) ? j.adminStaff : [];

  let percentTotal = 0;
  let flatMonthlyCents = 0;

  for (const item of staffArr) {
    if (!item || typeof item !== 'object') continue;

    const s = item as Record<string, unknown>;
    const comp = (s.compensation ?? {}) as Record<string, unknown>;
    const mode = String(comp.mode ?? 'none');

    if (mode === 'percent_revenue') {
      const p = Number(comp.percent ?? 0);
      if (Number.isFinite(p) && p > 0) {
        percentTotal += p;
      }
    } else if (mode === 'flat_monthly') {
      const v = Number(comp.amountCents ?? 0);
      if (Number.isFinite(v) && v > 0) {
        flatMonthlyCents += Math.round(v);
      }
    }
  }

  // Clamp to something sane so accountant cannot accidentally do 300%.
  percentTotal = Math.max(0, Math.min(80, percentTotal));

  return {
    percentRevenueTotalPercent: percentTotal,
    flatMonthlyNominalCents: flatMonthlyCents,
  };
}

/* ---------- Tax rate picker ---------- */

function pickTaxRate(
  rules: ClinicianTaxRules | null,
  grossCents: number,
  clinicianClassId: string | null,
  labourCode: string | null,
): number {
  if (!rules) return 0;

  let rate = Number(rules.defaultRatePercent ?? 0);

  const brackets = Array.isArray(rules.brackets) ? rules.brackets : [];
  if (brackets.length && grossCents > 0) {
    const found = brackets.find((b) => {
      const min = typeof b.minGrossCents === 'number' ? b.minGrossCents : 0;
      const max =
        typeof b.maxGrossCents === 'number'
          ? b.maxGrossCents
          : Number.POSITIVE_INFINITY;

      return grossCents >= min && grossCents <= max;
    });

    if (found) {
      rate = Number(found.ratePercent);
    }
  }

  const classOverrides = Array.isArray(rules.classOverrides)
    ? rules.classOverrides
    : [];

  if (clinicianClassId) {
    const c = classOverrides.find((x) => x.classId === clinicianClassId);
    if (c) {
      rate = Number(c.ratePercent);
    }
  }

  const labourOverrides = Array.isArray(rules.labourSectorOverrides)
    ? rules.labourSectorOverrides
    : [];

  if (labourCode) {
    const l = labourOverrides.find((x) => x.labourCode === labourCode);
    if (l) {
      rate = Number(l.ratePercent);
    }
  }

  return Math.max(0, Math.min(55, rate));
}

/* ---------- Payment funding source helpers ---------- */

function parsePaymentMeta(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw) return null;

  try {
    const out = JSON.parse(raw);
    return out && typeof out === 'object'
      ? (out as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function deriveFundingSource(
  paymentProvider: string | null,
  paymentMeta: unknown,
): FundingSource {
  const meta = parsePaymentMeta(paymentMeta);

  const methodRaw =
    meta?.method ||
    meta?.payment_method ||
    meta?.fundingSource;

  const method = methodRaw ? String(methodRaw).toLowerCase() : null;

  if (method === 'medical_aid' || method === 'medical-aid') {
    return 'medical_aid';
  }

  if (method === 'voucher' || method === 'promo') {
    return 'voucher';
  }

  if (method === 'card') return 'card';

  const prov = (paymentProvider || '').toLowerCase();

  if (
    prov === 'paystack' ||
    prov === 'stripe' ||
    prov === 'flutterwave'
  ) {
    return 'card';
  }

  return 'unknown';
}

function derivePayoutStatus(
  fundingSource: FundingSource,
  paymentStatus: string | null,
): PayoutStatus {
  const ps = (paymentStatus || '').toLowerCase();

  if (fundingSource === 'medical_aid') {
    if (ps === 'failed') return 'unpaid';
    return 'awaiting_scheme';
  }

  if (fundingSource === 'voucher') {
    return 'voucher_pool';
  }

  if (ps === 'captured') return 'paid';

  return 'unpaid';
}

/* ---------- GET /api/clinicians/me/payouts ---------- */

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentClinician(req);

    if (!ctx?.clinician) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      );
    }

    const { clinician, who } = ctx;
    const clinicianUserId = String(who.uid);

    const url = new URL(req.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setMonth(defaultFrom.getMonth() - 1);

    const from = fromStr
      ? startOfDay(new Date(fromStr))
      : startOfDay(defaultFrom);

    const to = toStr
      ? endOfDay(new Date(toStr))
      : endOfDay(today);

    const where: any = {
      clinicianId: clinicianUserId,
      status: { in: ['completed', 'confirmed'] },
      startsAt: { gte: from, lte: to },
    };

    const appts = await prisma.appointment.findMany({
      where,
      select: {
        id: true,
        encounterId: true,
        caseId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        priceCents: true,
        currency: true,
        platformFeeCents: true,
        clinicianTakeCents: true,
        paymentProvider: true,
        paymentRef: true,
        meta: true,
      },
    });

    const encounterIds = Array.from(
      new Set(
        appts
          .map((a) => a.encounterId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const payments = encounterIds.length
      ? await prisma.payment.findMany({
          where: {
            encounterId: { in: encounterIds },
          },
          select: {
            id: true,
            encounterId: true,
            caseId: true,
            amountCents: true,
            currency: true,
            status: true,
            meta: true,
            createdAt: true,
          },
        })
      : [];

    const paymentsByEncounter = new Map<
      string,
      Array<{
        id: string;
        encounterId: string;
        caseId: string | null;
        amountCents: number;
        currency: string;
        status: string;
        meta: unknown;
        createdAt: Date;
      }>
    >();

    for (const p of payments) {
      if (!p.encounterId) continue;

      const list = paymentsByEncounter.get(p.encounterId) || [];
      list.push({
        id: p.id,
        encounterId: p.encounterId,
        caseId: p.caseId,
        amountCents: p.amountCents,
        currency: p.currency,
        status: String(p.status),
        meta: p.meta,
        createdAt: p.createdAt,
      });
      paymentsByEncounter.set(p.encounterId, list);
    }

    for (const [k, list] of paymentsByEncounter) {
      list.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      paymentsByEncounter.set(k, list);
    }

    const {
      clinicianPercent,
      platformPercent,
      taxRules,
    } = await readPayoutSettings();

    let grossCents = 0;
    let currency = 'ZAR';

    const rows = appts.map((a) => {
      const basePrice = a.priceCents;
      grossCents += basePrice;
      currency = a.currency || currency;

      const netBase =
        a.clinicianTakeCents > 0
          ? a.clinicianTakeCents
          : Math.round((basePrice * clinicianPercent) / 100);

      const platformShare =
        a.platformFeeCents > 0
          ? a.platformFeeCents
          : Math.max(0, basePrice - netBase);

      const payList = a.encounterId
        ? paymentsByEncounter.get(a.encounterId) || []
        : [];

      const pay = payList[0] || null;

      const fundingSource = deriveFundingSource(
        a.paymentProvider,
        pay?.meta ?? null,
      );

      const payoutStatus = derivePayoutStatus(
        fundingSource,
        pay?.status ?? null,
      );

      return {
        id: a.id,
        encounterId: a.encounterId,
        caseId: a.caseId,
        startedAt: a.startsAt,
        endedAt: a.endsAt,
        status: a.status,
        feeCents: basePrice,
        netBaseToClinicianCents: netBase,
        platformShareCents: platformShare,
        paymentProvider: a.paymentProvider,
        paymentRef: a.paymentRef,
        fundingSource,
        payoutStatus,
      };
    });

    const netToClinicianCentsBeforeStaff = rows.reduce(
      (sum, r) => sum + r.netBaseToClinicianCents,
      0,
    );

    const platformShareCents = rows.reduce(
      (sum, r) => sum + r.platformShareCents,
      0,
    );

    /* ---------- Weekly & avg monthly ---------- */

    const weekStart = startOfWeek(today);

    const weekAppts = appts.filter(
      (a) => a.startsAt >= weekStart && a.startsAt <= today,
    );

    const weekGross = weekAppts.reduce(
      (sum, a) => sum + a.priceCents,
      0,
    );

    const weekNet = Math.round(
      (weekGross * clinicianPercent) / 100,
    );

    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentAppts = await prisma.appointment.findMany({
      where: {
        clinicianId: clinicianUserId,
        status: { in: ['completed', 'confirmed'] },
        startsAt: { gte: sixMonthsAgo, lte: today },
      },
      select: {
        priceCents: true,
        startsAt: true,
      },
    });

    const byMonth: Record<string, number> = {};

    recentAppts.forEach((a) => {
      const d = a.startsAt;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[k]) byMonth[k] = 0;
      byMonth[k] += a.priceCents;
    });

    const monthKeys = Object.keys(byMonth);

    const avgMonthlyNetCents =
      monthKeys.length === 0
        ? 0
        : Math.round(
            (monthKeys.reduce((sum, k) => sum + byMonth[k], 0) /
              monthKeys.length) *
              (clinicianPercent / 100),
          );

    /* ---------- Staff comp ---------- */

    const {
      percentRevenueTotalPercent: staffPercentTotal,
      flatMonthlyNominalCents,
    } = extractStaffCompFromProfile(clinician);

    const daysMs = endOfDay(to).getTime() - startOfDay(from).getTime();

    const daysInRange =
      daysMs <= 0
        ? 0
        : Math.round(daysMs / (1000 * 60 * 60 * 24)) + 1;

    let flatMonthlyProratedCents = 0;

    if (flatMonthlyNominalCents > 0 && daysInRange > 0) {
      const ref = to;
      const year = ref.getFullYear();
      const month = ref.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const ratio = Math.min(
        1,
        Math.max(0, daysInRange / daysInMonth),
      );

      flatMonthlyProratedCents = Math.round(
        flatMonthlyNominalCents * ratio,
      );
    }

    const staffPercentCompCents = Math.round(
      netToClinicianCentsBeforeStaff * (staffPercentTotal / 100),
    );

    const totalStaffCompCents =
      staffPercentCompCents + flatMonthlyProratedCents;

    const netToClinicianAfterStaffCents = Math.max(
      0,
      netToClinicianCentsBeforeStaff - totalStaffCompCents,
    );

    /* ---------- Tax ---------- */

    const profileJson = readProfileJson(clinician);

    const payoutSettings =
      (profileJson.payoutSettings ?? {}) as Record<string, unknown>;

    const clinicianClassId = payoutSettings.clinicianClassId
      ? String(payoutSettings.clinicianClassId)
      : null;

    const labourCode = profileJson.labourCode
      ? String(profileJson.labourCode)
      : profileJson.labourSector
        ? String(profileJson.labourSector)
        : null;

    const taxRatePercent = pickTaxRate(
      taxRules,
      grossCents,
      clinicianClassId,
      labourCode,
    );

    const estimatedTaxCents = Math.round(
      netToClinicianAfterStaffCents * (taxRatePercent / 100),
    );

    const netAfterStaffAndTaxCents = Math.max(
      0,
      netToClinicianAfterStaffCents - estimatedTaxCents,
    );

    /* ---------- Payout history ---------- */

    const lastPayout = await prisma.payout.findFirst({
      where: {
        role: 'clinician',
        entityId: clinician.id,
        status: { in: ['paid', 'completed'] },
      },
      orderBy: { periodEnd: 'desc' },
    });

    const nextPayout = await prisma.payout.findFirst({
      where: {
        role: 'clinician',
        entityId: clinician.id,
        status: 'pending',
      },
      orderBy: { periodStart: 'asc' },
    });

    const schedule: 'fortnightly' | 'monthly' =
      payoutSettings.schedule === 'fortnightly'
        ? 'fortnightly'
        : 'monthly';

    return NextResponse.json({
      ok: true,
      currency,
      splitPercent: {
        clinician: clinicianPercent,
        platform: platformPercent,
      },
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      earnings: {
        grossCents,
        netToClinicianCents: netToClinicianCentsBeforeStaff,
        platformShareCents,
        staffComp: {
          percentRevenueTotalPercent: staffPercentTotal,
          percentRevenueCents: staffPercentCompCents,
          flatMonthlyNominalCents,
          flatMonthlyProratedCents,
          totalStaffCompCents,
          netToClinicianAfterStaffCents,
        },
        tax: {
          effectiveRatePercent: taxRatePercent,
          estimatedTaxCents,
          netAfterStaffAndTaxCents,
        },
        thisWeekNetCents: weekNet,
        avgMonthlyNetCents,
      },
      lastPayout: {
        amountCents: lastPayout?.amountCents ?? 0,
        at: lastPayout?.periodEnd ?? null,
      },
      nextPayout: {
        amountCents: nextPayout?.amountCents ?? 0,
        at: nextPayout?.periodStart ?? null,
      },
      payoutSettings: {
        schedule,
        clinicianClassId,
        labourCode,
      },
      demographics: {
        byGender: {},
        byCity: [],
        byProvince: [],
      },
      rows,
    });
  } catch (e: any) {
    console.error('clinician payouts GET error', e);

    return NextResponse.json(
      { ok: false, error: e?.message || 'failed' },
      { status: 500 },
    );
  }
}

/* ---------- PUT: update payout schedule in profileJson ---------- */

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getCurrentClinician(req);

    if (!ctx?.clinician) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      );
    }

    const { clinician } = ctx;

    const body = await req
      .json()
      .catch(() => ({} as Record<string, unknown>));

    const scheduleRaw = String(body.schedule || '').toLowerCase();

    if (!['fortnightly', 'monthly'].includes(scheduleRaw)) {
      return NextResponse.json(
        { error: 'invalid_schedule' },
        { status: 400 },
      );
    }

    const schedule =
      scheduleRaw === 'fortnightly'
        ? 'fortnightly'
        : 'monthly';

    const profileJson = readProfileJson(clinician);

    const payoutSettings =
      (profileJson.payoutSettings ?? {}) as Record<string, unknown>;

    profileJson.payoutSettings = {
      ...payoutSettings,
      schedule,
    };

    const nextMeta = buildMetaForSave(clinician, profileJson);

    await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: { meta: nextMeta },
    });

    return NextResponse.json({ ok: true, schedule });
  } catch (e: any) {
    console.error('clinician payouts PUT error', e);

    return NextResponse.json(
      { ok: false, error: e?.message || 'failed' },
      { status: 500 },
    );
  }
}