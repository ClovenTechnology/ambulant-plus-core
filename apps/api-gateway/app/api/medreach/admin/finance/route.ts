import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
// A5_G_C_MEDREACH_PAYSTACK_TRANSFER_ROUTE_IMPORTS
import {
  buildPaystackTransferReference,
  checkPaystackTransferBalance,
  createPaystackTransferRecipient,
  extractPartnerBankDetails,
  initiatePaystackTransfer,
  paystackBankDetailsReady,
} from '@/src/payments/paystack-transfers';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TAKE = 100;
const MAX_TAKE = 500;

function clean(value: unknown, max = 256) {
  return String(value || "").trim().slice(0, max);
}

function asInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function iso(value: any) {
  return value?.toISOString?.() || (value ? String(value) : null);
}

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function roleOf(req: NextRequest) {
  return clean(req.headers.get("x-user-role") || req.headers.get("x-role") || "admin", 64).toLowerCase();
}

function orgIdFromHeaders(headers: Headers) {
  return clean(headers.get("x-org-id") || headers.get("x-tenant-id") || headers.get("x-organization-id") || "org-default", 128) || "org-default";
}

function canAccess(role: string) {
  return ["admin", "admin_staff", "system"].includes(role);
}

function pricingSnapshot(row: any): Record<string, any> {
  const value = row?.pricingSnapshot;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function providerFeeCents(row: any) {
  return asInt(pricingSnapshot(row).providerFeeCents, 0);
}

function grossTotalCents(row: any) {
  const labGross = asInt(row.labGrossCents || row.subtotalCents, 0);
  return (
    labGross +
    asInt(row.phlebGrossCents, 0) +
    asInt(row.logisticsFeeCents, 0) +
    asInt(row.urgentSurchargeCents, 0) +
    asInt(row.coldChainSurchargeCents, 0)
  );
}

function settlementState(row: any) {
  if (!row.labId && !row.phlebId) return "needs_provider";
  if (grossTotalCents(row) <= 0) return "needs_amount";
  if (asInt(row.labNetCents, 0) <= 0 && asInt(row.phlebNetCents, 0) <= 0) return "needs_net";
  return "ready";
}

function addToBucket(map: Map<string, any>, key: string, patch: Record<string, any>) {
  const current = map.get(key) || {
    id: key,
    name: key,
    orderCount: 0,
    grossCents: 0,
    platformFeeCents: 0,
    providerFeeCents: 0,
    netPayableCents: 0,
    orderIds: [],
  };

  current.orderCount += asInt(patch.orderCount, 0);
  current.grossCents += asInt(patch.grossCents, 0);
  current.platformFeeCents += asInt(patch.platformFeeCents, 0);
  current.providerFeeCents += asInt(patch.providerFeeCents, 0);
  current.netPayableCents += asInt(patch.netPayableCents, 0);

  if (patch.name) current.name = patch.name;
  if (patch.status) current.status = patch.status;
  if (patch.active !== undefined) current.active = patch.active;
  if (patch.userId) current.userId = patch.userId;
  if (patch.orderId) current.orderIds.push(patch.orderId);

  map.set(key, current);
}

async function labMap(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, any>();

  if (!unique.length) return map;

  const rows = await (prisma as any).labPartner
    ?.findMany?.({
      where: { id: { in: unique } },
      select: { id: true, name: true, status: true, active: true },
    })
    .catch(() => []);

  for (const row of rows || []) {
    map.set(row.id, row);
  }

  return map;
}

async function phlebMap(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, any>();

  if (!unique.length) return map;

  const rows = await (prisma as any).medReachPhlebProfile
    ?.findMany?.({
      where: {
        OR: [{ id: { in: unique } }, { userId: { in: unique } }],
      },
      select: { id: true, userId: true, approvalStatus: true, active: true },
    })
    .catch(() => []);

  for (const row of rows || []) {
    map.set(row.id, row);
    if (row.userId) map.set(row.userId, row);
  }

  return map;
}

function rowDto(row: any, labs: Map<string, any>, phlebs: Map<string, any>) {
  const lab = row.labId ? labs.get(row.labId) : null;
  const phleb = row.phlebId ? phlebs.get(row.phlebId) : null;
  const pricing = pricingSnapshot(row);
  const totalCents = grossTotalCents(row);
  const state = settlementState(row);

  return {
    id: row.id,
    orderId: row.orderId,
    drawId: row.drawId,
    labId: row.labId,
    labName: lab?.name || row.labId || null,
    labStatus: lab?.status || null,
    labActive: lab?.active ?? null,
    phlebId: row.phlebId,
    phlebUserId: phleb?.userId || row.phlebId || null,
    phlebStatus: phleb?.approvalStatus || null,
    currency: row.currency || pricing.currency || "ZAR",
    subtotalCents: asInt(row.subtotalCents, 0),
    logisticsFeeCents: asInt(row.logisticsFeeCents, 0),
    urgentSurchargeCents: asInt(row.urgentSurchargeCents, 0),
    coldChainSurchargeCents: asInt(row.coldChainSurchargeCents, 0),
    platformFeeCents: asInt(row.platformFeeCents, 0),
    providerFeeCents: providerFeeCents(row),
    labGrossCents: asInt(row.labGrossCents, 0),
    phlebGrossCents: asInt(row.phlebGrossCents, 0),
    labNetCents: asInt(row.labNetCents, 0),
    phlebNetCents: asInt(row.phlebNetCents, 0),
    sponsorAmountMinor: asInt(row.sponsorAmountMinor, 0),
    patientCopayMinor: asInt(row.patientCopayMinor, 0),
    totalCents,
    settlementState: state,
    settlementReady: state === "ready",
    pricingSnapshot: pricing,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function buildSummary(items: any[]) {
  const summary = {
    records: items.length,
    readyRecords: 0,
    needsReviewRecords: 0,
    grossCents: 0,
    labGrossCents: 0,
    phlebGrossCents: 0,
    logisticsFeeCents: 0,
    urgentSurchargeCents: 0,
    coldChainSurchargeCents: 0,
    platformFeeCents: 0,
    providerFeeCents: 0,
    labNetPayableCents: 0,
    phlebNetPayableCents: 0,
    sponsorAmountMinor: 0,
    patientCopayMinor: 0,
    currency: items[0]?.currency || "ZAR",
  };

  for (const item of items) {
    summary.grossCents += asInt(item.totalCents, 0);
    summary.labGrossCents += asInt(item.labGrossCents, 0);
    summary.phlebGrossCents += asInt(item.phlebGrossCents, 0);
    summary.logisticsFeeCents += asInt(item.logisticsFeeCents, 0);
    summary.urgentSurchargeCents += asInt(item.urgentSurchargeCents, 0);
    summary.coldChainSurchargeCents += asInt(item.coldChainSurchargeCents, 0);
    summary.platformFeeCents += asInt(item.platformFeeCents, 0);
    summary.providerFeeCents += asInt(item.providerFeeCents, 0);
    summary.labNetPayableCents += asInt(item.labNetCents, 0);
    summary.phlebNetPayableCents += asInt(item.phlebNetCents, 0);
    summary.sponsorAmountMinor += asInt(item.sponsorAmountMinor, 0);
    summary.patientCopayMinor += asInt(item.patientCopayMinor, 0);

    if (item.settlementReady) summary.readyRecords += 1;
    else summary.needsReviewRecords += 1;
  }

  return summary;
}

function buildBuckets(items: any[]) {
  const labs = new Map<string, any>();
  const phlebs = new Map<string, any>();

  for (const item of items) {
    if (item.labId) {
      addToBucket(labs, item.labId, {
        name: item.labName,
        status: item.labStatus,
        active: item.labActive,
        orderCount: 1,
        grossCents: item.labGrossCents,
        platformFeeCents: item.platformFeeCents,
        providerFeeCents: item.providerFeeCents,
        netPayableCents: item.labNetCents,
        orderId: item.orderId,
      });
    }

    if (item.phlebId) {
      addToBucket(phlebs, item.phlebId, {
        name: item.phlebUserId || item.phlebId,
        userId: item.phlebUserId,
        status: item.phlebStatus,
        orderCount: 1,
        grossCents: item.phlebGrossCents,
        netPayableCents: item.phlebNetCents,
        orderId: item.orderId,
      });
    }
  }

  return {
    labs: Array.from(labs.values()).sort((a, b) => b.netPayableCents - a.netPayableCents),
    phlebs: Array.from(phlebs.values()).sort((a, b) => b.netPayableCents - a.netPayableCents),
  };
}


type PayoutPreviewLine = {
  actorType: "LAB" | "PHLEB";
  actorId: string;
  name: string;
  grossCents: number;
  deductionsCents: number;
  netCents: number;
  currency: string;
  orderIds: string[];
  financialIds: string[];
};

type LoadedSettlementItems = {
  from: Date;
  to: Date;
  filters: Record<string, unknown>;
  items: any[];
  summary: Record<string, unknown>;
  payouts: PayoutPreviewLine[];
};

function payoutLineKey(actorType: "LAB" | "PHLEB", actorId: string) {
  return actorType + ":" + actorId;
}

function mergePayoutLine(map: Map<string, PayoutPreviewLine>, line: PayoutPreviewLine) {
  const key = payoutLineKey(line.actorType, line.actorId);
  const current = map.get(key);

  if (!current) {
    map.set(key, {
      ...line,
      orderIds: Array.from(new Set(line.orderIds)),
      financialIds: Array.from(new Set(line.financialIds)),
    });
    return;
  }

  current.grossCents += line.grossCents;
  current.deductionsCents += line.deductionsCents;
  current.netCents += line.netCents;
  current.orderIds = Array.from(new Set([...current.orderIds, ...line.orderIds]));
  current.financialIds = Array.from(new Set([...current.financialIds, ...line.financialIds]));
}

function buildPayoutPreview(items: any[]) {
  const map = new Map<string, PayoutPreviewLine>();

  for (const item of items) {
    const currency = clean(item.currency || "ZAR", 3).toUpperCase() || "ZAR";
    const financialIds = [clean(item.id, 128)].filter(Boolean);
    const orderIds = [clean(item.orderId, 128)].filter(Boolean);

    if (item.labId && asInt(item.labNetCents, 0) > 0) {
      const grossCents = asInt(item.labGrossCents, 0);
      const netCents = asInt(item.labNetCents, 0);

      mergePayoutLine(map, {
        actorType: "LAB",
        actorId: clean(item.labId, 128),
        name: item.labName || item.labId,
        grossCents,
        deductionsCents: Math.max(0, grossCents - netCents),
        netCents,
        currency,
        orderIds,
        financialIds,
      });
    }

    if (item.phlebId && asInt(item.phlebNetCents, 0) > 0) {
      const grossCents = asInt(item.phlebGrossCents, 0);
      const netCents = asInt(item.phlebNetCents, 0);

      mergePayoutLine(map, {
        actorType: "PHLEB",
        actorId: clean(item.phlebId, 128),
        name: item.phlebUserId || item.phlebId,
        grossCents,
        deductionsCents: Math.max(0, grossCents - netCents),
        netCents,
        currency,
        orderIds,
        financialIds,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.netCents - a.netCents);
}

async function loadFinanceItemsForSettlement(req: NextRequest, body: any) {
  const delegate = (prisma as any).medReachOrderFinancial;

  if (!delegate?.findMany) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "medreach_order_financial_model_not_configured" },
        { status: 501 },
      ),
    };
  }

  const now = new Date();
  const fallbackFrom = new Date(now);
  fallbackFrom.setDate(now.getDate() - 30);

  const from = parseDate(clean(body?.from, 64) || null, fallbackFrom);
  const to = parseDate(clean(body?.to, 64) || null, now);
  const take = Math.min(MAX_TAKE, Math.max(1, asInt(body?.take, MAX_TAKE)));

  const labId = clean(body?.labId, 128);
  const phlebId = clean(body?.phlebId, 128);
  const orderId = clean(body?.orderId, 128);
  const stateFilter = clean(body?.settlementState || body?.state || "ready", 64).toLowerCase();

  const where: any = {
    createdAt: { gte: from, lte: to },
  };

  if (labId) where.labId = labId;
  if (phlebId) where.phlebId = phlebId;
  if (orderId) where.orderId = orderId;

  const rows = await delegate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });

  const labs = await labMap(rows.map((row: any) => row.labId).filter(Boolean));
  const phlebs = await phlebMap(rows.map((row: any) => row.phlebId).filter(Boolean));

  let items = rows.map((row: any) => rowDto(row, labs, phlebs));

  if (stateFilter) {
    items = items.filter((item: any) => item.settlementState === stateFilter);
  }

  return {
    ok: true as const,
    from,
    to,
    filters: { labId, phlebId, orderId, settlementState: stateFilter },
    items,
    summary: buildSummary(items),
    payouts: buildPayoutPreview(items),
  };
}

async function existingPayoutForLine(payoutDelegate: any, line: PayoutPreviewLine, from: Date, to: Date) {
  if (!payoutDelegate?.findFirst) return null;

  return payoutDelegate
    .findFirst({
      where: {
        actorType: line.actorType as any,
        actorId: line.actorId,
        periodStart: from,
        periodEnd: to,
      },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => null);
}

export async function GET(req: NextRequest) {
  try {
    const role = roleOf(req);

    if (!canAccess(role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const delegate = (prisma as any).medReachOrderFinancial;

    if (!delegate?.findMany) {
      return NextResponse.json(
        {
          ok: false,
          error: "medreach_order_financial_model_not_configured",
        },
        { status: 501 },
      );
    }

    const url = req.nextUrl;
    const now = new Date();
    const fallbackFrom = new Date(now);
    fallbackFrom.setDate(now.getDate() - 30);

    const from = parseDate(url.searchParams.get("from"), fallbackFrom);
    const to = parseDate(url.searchParams.get("to"), now);
    const take = Math.min(MAX_TAKE, Math.max(1, asInt(url.searchParams.get("take"), DEFAULT_TAKE)));

    const labId = clean(url.searchParams.get("labId"), 128);
    const phlebId = clean(url.searchParams.get("phlebId"), 128);
    const orderId = clean(url.searchParams.get("orderId"), 128);
    const stateFilter = clean(url.searchParams.get("settlementState") || url.searchParams.get("state"), 64).toLowerCase();

    const where: any = {
      createdAt: { gte: from, lte: to },
    };

    if (labId) where.labId = labId;
    if (phlebId) where.phlebId = phlebId;
    if (orderId) where.orderId = orderId;

    const rows = await delegate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });

    const labs = await labMap(rows.map((row: any) => row.labId).filter(Boolean));
    const phlebs = await phlebMap(rows.map((row: any) => row.phlebId).filter(Boolean));

    let items = rows.map((row: any) => rowDto(row, labs, phlebs));

    if (stateFilter) {
      items = items.filter((item: any) => item.settlementState === stateFilter);
    }

    const summary = buildSummary(items);
    const buckets = buildBuckets(items);

    return NextResponse.json({
      ok: true,
      orgId: orgIdFromHeaders(req.headers),
      from: from.toISOString(),
      to: to.toISOString(),
      limit: take,
      summary,
      rows: items,
      labs: buckets.labs,
      phlebs: buckets.phlebs,
      filters: { labId, phlebId, orderId, settlementState: stateFilter },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "medreach_admin_finance_load_failed" },
      { status: 500 },
    );
  }
}



// A5_G_C_MEDREACH_PAYSTACK_TRANSFER_ROUTE_HELPERS
function a5gJsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function a5gText(value: unknown, max = 512) {
  const raw = value === undefined || value === null ? '' : String(value);
  return raw.trim().slice(0, max);
}

function a5gPayoutIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => a5gText(item, 180)).filter(Boolean);
  }

  const one = a5gText(value, 180);
  return one ? [one] : [];
}

async function a5gLoadMedReachPayoutActorProfile(row: any) {
  const actorType = a5gText(row?.actorType, 40).toUpperCase();
  const actorId = a5gText(row?.actorId, 180);

  if (!actorId) return null;

  if (actorType === 'LAB') {
    return (prisma as any).labPartner?.findUnique?.({ where: { id: actorId } }).catch(() => null);
  }

  if (actorType === 'PHLEB' || actorType === 'PHLEBOTOMIST') {
    return (prisma as any).medReachPhlebProfile?.findUnique?.({ where: { id: actorId } }).catch(() => null);
  }

  return null;
}

function a5gMedReachPayoutTransferStatus(paystackStatus: string) {
  const status = a5gText(paystackStatus, 40).toLowerCase();

  if (status === 'success') return 'PAID';
  if (status === 'failed' || status === 'abandoned' || status === 'reversed') return 'FAILED';

  return 'PENDING';
}

async function a5gSendMedReachPaystackTransferForPayout(row: any, orgId: string, actorRole: string) {
  const currentMeta = a5gJsonObject(row?.meta);
  const profile = await a5gLoadMedReachPayoutActorProfile(row);

  const bankDetails = extractPartnerBankDetails({
    ...a5gJsonObject(profile),
    meta: currentMeta,
    payoutMeta: currentMeta,
  });

  if (!paystackBankDetailsReady(bankDetails)) {
    return {
      ok: false,
      payoutId: row?.id,
      actorType: row?.actorType,
      actorId: row?.actorId,
      status: 'skipped',
      error: 'partner_bank_details_missing_or_incomplete',
    };
  }

  const existingTransfer = a5gJsonObject(currentMeta.paystackTransfer);
  const existingRecipientCode =
    a5gText(existingTransfer.recipientCode || bankDetails?.paystackRecipientCode, 180) || null;

  const recipient = existingRecipientCode
    ? {
        recipientCode: existingRecipientCode,
        raw: { source: 'existing_recipient_code' },
      }
    : await createPaystackTransferRecipient({
        name: bankDetails!.accountName,
        accountNumber: bankDetails!.accountNumber,
        bankCode: bankDetails!.bankCode,
        currency: bankDetails!.currency || row?.currency || 'ZAR',
        country: bankDetails!.country || 'ZA',
        metadata: {
          source: 'ambulant_medreach_partner_payout',
          orgId,
          payoutId: row?.id,
          actorType: row?.actorType,
          actorId: row?.actorId,
        },
      });

  const reference =
    a5gText(existingTransfer.reference, 180) ||
    buildPaystackTransferReference(['ambulant', 'medreach', 'payout', row?.id]);

  const transfer = await initiatePaystackTransfer({
    amountCents: Number(row?.netCents || 0),
    recipientCode: recipient.recipientCode,
    reference,
    currency: row?.currency || bankDetails!.currency || 'ZAR',
    reason: 'Ambulant+ MedReach partner payout',
    metadata: {
      source: 'ambulant_medreach_partner_payout',
      orgId,
      payoutId: row?.id,
      actorType: row?.actorType,
      actorId: row?.actorId,
      generatedByRole: actorRole,
    },
  });

  const nextStatus = a5gMedReachPayoutTransferStatus(transfer.status);
  const paidLike = nextStatus === 'PAID';
  const failedLike = nextStatus === 'FAILED';

  const nextMeta: any = {
    ...currentMeta,
    paystackTransfer: {
      provider: 'paystack',
      transferEnabled: true,
      reference: transfer.reference || reference,
      transferCode: transfer.transferCode || existingTransfer.transferCode || null,
      recipientCode: transfer.recipientCode || recipient.recipientCode,
      status: transfer.status,
      amountCents: transfer.amountCents ?? Number(row?.netCents || 0),
      currency: transfer.currency || row?.currency || bankDetails!.currency || 'ZAR',
      message: transfer.message || null,
      submittedAt: new Date().toISOString(),
      submittedByRole: actorRole,
      recipientSource: existingRecipientCode ? 'existing' : 'created',
      bankDetailsSource: bankDetails!.source || null,
      raw: transfer.raw,
    },
  };

  const updateData: any = {
    meta: nextMeta,
    payoutRef: transfer.reference || reference,
    status: nextStatus as any,
  };

  if (failedLike) {
    nextMeta.failureReason = transfer.message || 'paystack_transfer_failed';
  }

  const updated = await (prisma as any).medReachPayout.update({
    where: { id: row.id },
    data: updateData,
  });

  return {
    ok: true,
    payoutId: row.id,
    actorType: row.actorType,
    actorId: row.actorId,
    amountCents: Number(row?.netCents || 0),
    currency: row?.currency || bankDetails!.currency || 'ZAR',
    paystackStatus: transfer.status,
    payoutStatus: nextStatus,
    paid: paidLike,
    failed: failedLike,
    reference: transfer.reference || reference,
    transferCode: transfer.transferCode || null,
    recipientCode: transfer.recipientCode || recipient.recipientCode,
    updated,
  };
}

export async function POST(req: NextRequest) {
  try {
    const role = roleOf(req);

    if (!canAccess(role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action || "dry_run", 64).toLowerCase();
    const orgId = orgIdFromHeaders(req.headers);
    const payoutDelegate = (prisma as any).medReachPayout;

    if (!payoutDelegate?.create) {
      return NextResponse.json({ ok: false, error: "medreach_payout_model_not_configured" }, { status: 501 });
    }


    if (action === "check_paystack_balance" || action === "paystack_balance") {
      const currency = clean(body?.currency || "ZAR", 8).toUpperCase() || "ZAR";
      const balance = await checkPaystackTransferBalance(currency);

      return NextResponse.json({
        ok: true,
        action,
        provider: "paystack",
        transferEnabled: true,
        balance,
      });
    }

    if (["send_paystack_transfer", "send_paystack_transfers", "paystack_transfer"].includes(action)) {
      const ids = a5gPayoutIds(body?.payoutIds || body?.payoutId || body?.ids);

      if (!ids.length) {
        return NextResponse.json({ ok: false, error: "payoutIds_required" }, { status: 400 });
      }

      if (!payoutDelegate?.findMany || !(prisma as any).medReachPayout?.update) {
        return NextResponse.json({ ok: false, error: "medreach_payout_transfer_update_not_configured" }, { status: 501 });
      }

      const rows = await payoutDelegate.findMany({ where: { id: { in: ids } } });
      const transferActorRole = a5gText(req.headers.get("x-user-role") || req.headers.get("x-role") || "admin", 80);

      const results: any[] = [];
      const skipped: any[] = [];

      for (const row of rows) {
        if (String(row?.status || "").toUpperCase() === "PAID") {
          skipped.push({
            payoutId: row.id,
            reason: "already_paid",
            payoutRef: row.payoutRef || null,
          });
          continue;
        }

        if (Number(row?.netCents || 0) <= 0) {
          skipped.push({
            payoutId: row.id,
            reason: "net_amount_not_positive",
          });
          continue;
        }

        try {
          results.push(await a5gSendMedReachPaystackTransferForPayout(row, orgId, transferActorRole));
        } catch (error: any) {
          results.push({
            ok: false,
            payoutId: row.id,
            actorType: row.actorType,
            actorId: row.actorId,
            status: "failed",
            error: error?.message || "paystack_transfer_failed",
            payload: error?.payload || null,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        action,
        provider: "paystack",
        transferEnabled: true,
        requestedCount: ids.length,
        foundCount: rows.length,
        transferredCount: results.filter((row: any) => row?.ok).length,
        failedCount: results.filter((row: any) => row?.ok === false).length,
        skippedCount: skipped.length,
        transferResults: results,
        skippedPayouts: skipped,
      });
    }

    if (action === "mark_paid" || action === "mark_failed") {
      const ids = Array.isArray(body?.payoutIds)
        ? body.payoutIds.map((id: unknown) => clean(id, 128)).filter(Boolean)
        : [clean(body?.payoutId, 128)].filter(Boolean);

      if (!ids.length) {
        return NextResponse.json({ ok: false, error: "payoutIds_required" }, { status: 400 });
      }

      if (!payoutDelegate?.findMany || !payoutDelegate?.update) {
        return NextResponse.json({ ok: false, error: "medreach_payout_update_not_configured" }, { status: 501 });
      }

      const now = new Date();
      const status = action === "mark_paid" ? "PAID" : "FAILED";
      const payoutRef = clean(body?.payoutRef || body?.remittanceRef, 160);
      const failureReason = clean(body?.failureReason || body?.reason, 1000);

      const existingRows = await payoutDelegate.findMany({ where: { id: { in: ids } } });
      const updated = [];

      for (const row of existingRows || []) {
        const currentMeta =
          row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {};

        const data: any = {
          status: status as any,
          meta: {
            ...currentMeta,
            lastFinanceAction: action,
            lastFinanceActionAt: now.toISOString(),
            lastFinanceActionByRole: role,
            failureReason: status === "FAILED" ? failureReason || null : currentMeta.failureReason || null,
          },
        };

        if (status === "PAID" && payoutRef) data.payoutRef = payoutRef;

        updated.push(await payoutDelegate.update({ where: { id: row.id }, data }));
      }

      return NextResponse.json({
        ok: true,
        action,
        orgId,
        status,
        count: updated.length,
        payouts: updated,
      });
    }

    if (!["dry_run", "preview", "generate_batch", "generate", "create", "check_paystack_balance", "paystack_balance", "send_paystack_transfer", "send_paystack_transfers", "paystack_transfer"].includes(action)) {
      return NextResponse.json({ ok: false, error: "unsupported_action" }, { status: 400 });
    }

    const loaded = await loadFinanceItemsForSettlement(req, body);

    if (!loaded.ok) {
      return loaded.response;
    }

    const settlement = loaded as LoadedSettlementItems;
    const dryRun = action === "dry_run" || action === "preview";
    const generated = [];
    const skipped = [];

    if (!dryRun) {
      for (const line of settlement.payouts) {
        if (line.netCents <= 0) continue;

        const existing = await existingPayoutForLine(payoutDelegate, line, settlement.from, settlement.to);

        if (existing) {
          skipped.push({ ...line, existingPayoutId: existing.id, existingStatus: existing.status });
          continue;
        }

        const created = await payoutDelegate.create({
          data: {
            actorType: line.actorType as any,
            actorId: line.actorId,
            periodStart: settlement.from,
            periodEnd: settlement.to,
            grossCents: Math.max(0, line.grossCents),
            deductionsCents: Math.max(0, line.deductionsCents),
            netCents: Math.max(0, line.netCents),
            currency: line.currency || "ZAR",
            status: "PENDING" as any,
            meta: {
              source: "medreach_admin_finance",
              orgId,
              action: "generate_batch",
              generatedAt: new Date().toISOString(),
              generatedByRole: role,
              actorType: line.actorType,
              actorId: line.actorId,
              orderIds: line.orderIds,
              financialIds: line.financialIds,
              periodStart: settlement.from.toISOString(),
              periodEnd: settlement.to.toISOString(),
            },
          },
        });

        generated.push(created);
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      dryRun,
      orgId,
      from: settlement.from.toISOString(),
      to: settlement.to.toISOString(),
      filters: settlement.filters,
      summary: settlement.summary,
      rows: settlement.items,
      payoutPreview: settlement.payouts,
      generatedPayouts: generated,
      skippedPayouts: skipped,
      generatedCount: generated.length,
      skippedCount: skipped.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "medreach_admin_finance_settlement_action_failed" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
