import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_J_F_C_CLINICIAN_CONTRACTOR_PAYOUT_SUMMARY_API

type PayoutSchedule = 'fortnightly' | 'monthly';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function asObject(value: unknown): Record<string, any> {
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

function asCents(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function text(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function normalizeSchedule(raw: unknown): PayoutSchedule {
  return raw === 'monthly' ? 'monthly' : 'fortnightly';
}

function getProfileJson(clinician: any): Record<string, any> {
  const meta = asObject(clinician?.meta);

  if (meta.rawProfile && typeof meta.rawProfile === 'object' && !Array.isArray(meta.rawProfile)) {
    return meta.rawProfile as Record<string, any>;
  }

  if (typeof meta.rawProfileJson === 'string') {
    return asObject(meta.rawProfileJson);
  }

  return meta;
}

function parseDate(value: string | null, fallback: Date, endOfDay = false) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function rangeFromRequest(req: NextRequest) {
  const url = new URL(req.url);
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const fromDate = parseDate(url.searchParams.get('from'), thirtyDaysAgo, false);
  const toDate = parseDate(url.searchParams.get('to'), today, true);

  return {
    fromDate,
    toDate,
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
  };
}

async function resolveClinician(req: NextRequest) {
  const url = new URL(req.url);
  const devLookup =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_CLINICIAN_PAYOUT_DEV_LOOKUP === '1';

  const headerClinicianId = text(req.headers.get('x-clinician-id'), 180);
  if (headerClinicianId) {
    const profile = await prisma.clinicianProfile.findUnique({
      where: { id: headerClinicianId },
    });
    if (profile) return profile;
  }

  const headerUserId = text(req.headers.get('x-user-id'), 180);
  if (headerUserId) {
    const profile = await prisma.clinicianProfile.findUnique({
      where: { userId: headerUserId },
    });
    if (profile) return profile;
  }

  const headerEmail = text(req.headers.get('x-user-email') || req.headers.get('x-clinician-email'), 240);
  if (headerEmail) {
    const profile = await prisma.clinicianProfile.findFirst({
      where: { email: headerEmail },
      orderBy: { createdAt: 'asc' },
    });
    if (profile) return profile;
  }

  const clinicianId = text(url.searchParams.get('clinicianId'), 180);
  if (devLookup && clinicianId) {
    return prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });
  }

  if (devLookup) {
    return prisma.clinicianProfile.findFirst({
      orderBy: { createdAt: 'asc' },
    });
  }

  return null;
}

function payoutEntityIds(clinician: any) {
  return Array.from(
    new Set(
      [
        text(clinician?.id, 180),
        text(clinician?.userId, 180),
        text(clinician?.email, 240),
      ].filter(Boolean),
    ),
  );
}

function rowFromPayout(payout: any) {
  const meta = asObject(payout.meta);
  const contractorPayoutSummary = asObject(meta.contractorPayoutSummary);
  const paystackTransfer = asObject(meta.paystackTransfer);
  const manualReconciliation = asObject(meta.manualReconciliation);

  const grossEarningsCents = asCents(
    contractorPayoutSummary.grossEarningsCents ??
      meta.grossEligibleCents ??
      asCents(payout.amountCents) + asCents(contractorPayoutSummary.platformFeeCents ?? meta.platformFeeCents),
  );

  const platformFeeCents = asCents(contractorPayoutSummary.platformFeeCents ?? meta.platformFeeCents);
  const refundCents = asCents(contractorPayoutSummary.refundCents ?? meta.refundCents);
  const onboardingInstalmentCents = asCents(contractorPayoutSummary.onboardingInstalmentCents);
  const planFeeCents = asCents(contractorPayoutSummary.planFeeCents);
  const customDeductionCents = asCents(contractorPayoutSummary.customDeductionCents);
  const taxWithholdingCents = asCents(contractorPayoutSummary.taxWithholdingCents);
  const totalChargedDeductionsCents = asCents(
    contractorPayoutSummary.totalChargedDeductionsCents ??
      onboardingInstalmentCents + planFeeCents + customDeductionCents + taxWithholdingCents,
  );

  const periodStart = payout.periodStart ? new Date(payout.periodStart) : null;
  const periodEnd = payout.periodEnd ? new Date(payout.periodEnd) : periodStart;

  return {
    id: payout.id,
    role: payout.role,
    entityId: payout.entityId,
    periodStart: periodStart ? periodStart.toISOString() : null,
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
    periodMonth:
      text(contractorPayoutSummary.periodMonth, 16) ||
      (periodEnd ? periodEnd.toISOString().slice(0, 7) : null),
    amountCents: asCents(payout.amountCents),
    currency: payout.currency || 'ZAR',
    status: payout.status || 'pending',
    payoutRef:
      text(meta.payoutRef, 180) ||
      text(contractorPayoutSummary.payoutReference, 180) ||
      text(paystackTransfer.reference, 180) ||
      text(manualReconciliation.remittanceRef, 180) ||
      null,
    paymentRef: text(contractorPayoutSummary.paymentRef ?? meta.paymentRef, 180) || null,
    transferStatus: text(contractorPayoutSummary.transferStatus ?? paystackTransfer.status, 120) || null,
    transferCode: text(paystackTransfer.transferCode, 180) || null,
    grossEarningsCents,
    refundCents,
    platformFeeCents,
    baseClinicianTakeCents: asCents(contractorPayoutSummary.baseClinicianTakeCents ?? meta.clinicianTakeCents ?? payout.amountCents),
    onboardingInstalmentCents,
    planFeeCents,
    customDeductionCents,
    taxWithholdingCents,
    taxEstimateCents: asCents(contractorPayoutSummary.taxEstimateCents),
    totalChargedDeductionsCents,
    netPayableCents: asCents(contractorPayoutSummary.netPayableCents ?? payout.amountCents),
    deductionLines: Array.isArray(contractorPayoutSummary.deductionLines)
      ? contractorPayoutSummary.deductionLines
      : [],
    customDeductions: Array.isArray(contractorPayoutSummary.customDeductions)
      ? contractorPayoutSummary.customDeductions
      : [],
    taxAdvisory: contractorPayoutSummary.taxAdvisory || null,
    contractorNotice:
      text(contractorPayoutSummary.contractorNotice, 2000) ||
      'This is a contractor payout summary, not an employment payslip. Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain your responsibility unless Ambulant+ explicitly applies a deduction line.',
    generatedAt: text(meta.generatedAt, 80) || null,
    source: text(meta.source, 120) || null,
  };
}

function monthlySummaries(rows: any[]) {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = row.periodMonth || 'unassigned';

    if (!map.has(key)) {
      map.set(key, {
        month: key,
        count: 0,
        grossEarningsCents: 0,
        platformFeeCents: 0,
        refundCents: 0,
        totalDeductionsCents: 0,
        netPayableCents: 0,
        paidCents: 0,
        pendingCents: 0,
        failedCents: 0,
      });
    }

    const entry = map.get(key);
    entry.count += 1;
    entry.grossEarningsCents += asCents(row.grossEarningsCents);
    entry.platformFeeCents += asCents(row.platformFeeCents);
    entry.refundCents += asCents(row.refundCents);
    entry.totalDeductionsCents += asCents(row.totalChargedDeductionsCents);
    entry.netPayableCents += asCents(row.netPayableCents);

    const status = String(row.status || '').toLowerCase();
    if (status === 'paid') entry.paidCents += asCents(row.netPayableCents);
    else if (status === 'failed') entry.failedCents += asCents(row.netPayableCents);
    else entry.pendingCents += asCents(row.netPayableCents);
  }

  return Array.from(map.values()).sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

function totals(rows: any[]) {
  return rows.reduce(
    (acc, row) => {
      const net = asCents(row.netPayableCents);
      const status = String(row.status || '').toLowerCase();

      acc.count += 1;
      acc.grossEarningsCents += asCents(row.grossEarningsCents);
      acc.platformFeeCents += asCents(row.platformFeeCents);
      acc.refundCents += asCents(row.refundCents);
      acc.totalDeductionsCents += asCents(row.totalChargedDeductionsCents);
      acc.netPayableCents += net;

      if (status === 'paid') {
        acc.paidCents += net;
        acc.paidCount += 1;
      } else if (status === 'failed') {
        acc.failedCents += net;
        acc.failedCount += 1;
      } else {
        acc.pendingCents += net;
        acc.pendingCount += 1;
      }

      return acc;
    },
    {
      count: 0,
      grossEarningsCents: 0,
      platformFeeCents: 0,
      refundCents: 0,
      totalDeductionsCents: 0,
      netPayableCents: 0,
      paidCents: 0,
      pendingCents: 0,
      failedCents: 0,
      paidCount: 0,
      pendingCount: 0,
      failedCount: 0,
    },
  );
}

function csvEscape(value: unknown) {
  const raw = String(value ?? '');
  return /[",\n\r]/.test(raw) ? '"' + raw.replace(/"/g, '""') + '"' : raw;
}

function csvForRows(rows: any[]) {
  const header = [
    'Payout ID',
    'Period Month',
    'Period Start',
    'Period End',
    'Status',
    'Currency',
    'Gross Earnings',
    'Refunds',
    'Platform Fee',
    'Charged Deductions',
    'Net Payable',
    'Payout Reference',
    'Transfer Status',
    'Transfer Code',
    'Tax Advisory',
    'Contractor Notice',
  ];

  const lines = [
    header,
    ...rows.map((row) => [
      row.id,
      row.periodMonth,
      row.periodStart,
      row.periodEnd,
      row.status,
      row.currency,
      row.grossEarningsCents,
      row.refundCents,
      row.platformFeeCents,
      row.totalChargedDeductionsCents,
      row.netPayableCents,
      row.payoutRef,
      row.transferStatus,
      row.transferCode,
      asObject(row.taxAdvisory).message || '',
      row.contractorNotice,
    ]),
  ];

  return lines.map((line) => line.map(csvEscape).join(',')).join('\n');
}

function buildPayload(clinician: any, rows: any[], range: any) {
  const profileJson = getProfileJson(clinician);
  const payoutSettings = asObject(profileJson.payoutSettings);
  const summaryTotals = totals(rows);
  const monthly = monthlySummaries(rows);
  const paidRows = rows
    .filter((row) => String(row.status || '').toLowerCase() === 'paid')
    .sort((a, b) => String(b.periodEnd || '').localeCompare(String(a.periodEnd || '')));

  return {
    ok: true,
    type: 'ambulant_contractor_payout_summary',
    label: 'Ambulant+ Contractor Payout Summary',
    currency: rows[0]?.currency || clinician?.currency || 'ZAR',
    clinician: {
      id: clinician?.id,
      userId: clinician?.userId,
      displayName: clinician?.displayName || profileJson.displayName || null,
      email: clinician?.email || profileJson.email || null,
    },
    range: {
      from: range.from,
      to: range.to,
    },
    items: rows,
    monthlySummaries: monthly,
    totals: summaryTotals,
    emptyState: rows.length
      ? null
      : {
          title: 'No payout summary yet.',
          message: "You haven't completed any eligible jobs yet.",
        },
    contractorNotice:
      'This is a contractor payout summary, not an employment payslip. Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain your responsibility unless Ambulant+ explicitly applies a deduction line.',
    payoutSettings: {
      schedule: normalizeSchedule(payoutSettings.schedule),
      bankLast4: payoutSettings.bankLast4 || payoutSettings.accountLast4 || null,
      payoutAccountId: clinician?.payoutAccountId || payoutSettings.payoutAccountId || null,
      currentPlanId: payoutSettings.planTierId || payoutSettings.currentPlanId || 'solo',
      billingCycle: payoutSettings.billingCycle || 'monthly',
    },
    lastPayout: {
      amountCents: paidRows[0]?.netPayableCents || 0,
      at: paidRows[0]?.periodEnd || null,
      reference: paidRows[0]?.payoutRef || null,
    },
    nextPayout: {
      amountCents: summaryTotals.pendingCents,
      at: null,
    },
    earnings: {
      grossCents: summaryTotals.grossEarningsCents,
      refundsCents: summaryTotals.refundCents,
      platformFeeCents: summaryTotals.platformFeeCents,
      netCents: summaryTotals.netPayableCents,
      consultations: rows.length,
    },
    splitPercent: {
      clinician: 100,
      platform: 0,
    },
    demographics: {
      gender: {},
      cities: [],
      provinces: [],
    },
  };
}

async function loadPayoutRows(clinician: any, req: NextRequest) {
  const range = rangeFromRequest(req);
  const ids = payoutEntityIds(clinician);

  if (!ids.length) return { range, rows: [] };

  const payouts = await (prisma as any).payout.findMany({
    where: {
      role: 'clinician',
      entityId: { in: ids },
      periodStart: {
        gte: range.fromDate,
        lte: range.toDate,
      },
    },
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  return {
    range,
    rows: payouts.map(rowFromPayout),
  };
}

/**
 * GET /api/clinicians/me/payouts
 *
 * Self-scoped clinician Contractor Payout Summary.
 * Supports CSV using ?format=csv.
 */
export async function GET(req: NextRequest) {
  try {
    const clinician = await resolveClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'clinician_profile_not_found' }, 404);
    }

    const { range, rows } = await loadPayoutRows(clinician, req);
    const payload = buildPayload(clinician, rows, range);

    const url = new URL(req.url);
    const wantsCsv =
      url.searchParams.get('format') === 'csv' ||
      url.searchParams.get('download') === 'csv';

    if (wantsCsv) {
      const csv = csvForRows(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="ambulant-contractor-payout-summary.csv"',
          'cache-control': 'no-store',
        },
      });
    }

    return json(payload);
  } catch (err: any) {
    console.error('GET /api/clinicians/me/payouts error', err);
    return json(
      { ok: false, error: err?.message || 'failed_to_load_contractor_payout_summary' },
      500,
    );
  }
}

/**
 * PUT /api/clinicians/me/payouts
 *
 * Preserves the existing payout-schedule update behaviour.
 */
export async function PUT(req: NextRequest) {
  try {
    const clinician = await resolveClinician(req);

    if (!clinician) {
      return json({ ok: false, error: 'clinician_profile_not_found' }, 404);
    }

    const body = await req.json().catch(() => ({}));
    const nextSchedule = normalizeSchedule(body?.schedule);

    const existingMeta = asObject((clinician as any).meta);
    const profileJson = getProfileJson(clinician);
    const prevPayoutSettings = asObject(profileJson.payoutSettings);

    const nextProfileJson = {
      ...profileJson,
      payoutSettings: {
        ...prevPayoutSettings,
        schedule: nextSchedule,
      },
    };

    const updated = await prisma.clinicianProfile.update({
      where: { id: clinician.id },
      data: {
        meta: {
          ...existingMeta,
          rawProfile: nextProfileJson,
          rawProfileJson: JSON.stringify(nextProfileJson),
        } as any,
      },
    });

    const { range, rows } = await loadPayoutRows(updated, req);
    return json(buildPayload(updated, rows, range));
  } catch (err: any) {
    console.error('PUT /api/clinicians/me/payouts error', err);
    return json(
      { ok: false, error: err?.message || 'failed_to_update_payout_schedule' },
      500,
    );
  }
}
