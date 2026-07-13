import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

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

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
