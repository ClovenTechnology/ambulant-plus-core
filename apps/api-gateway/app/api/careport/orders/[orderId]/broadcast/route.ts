// apps/api-gateway/app/api/careport/orders/[orderId]/broadcast/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import {
  correlationIdFromHeaders,
  orgIdFromHeaders,
  requireRole,
  haversineKm,
} from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BroadcastPolicy = {
  initialRadiusKm: number;
  expansionIntervalMinutes: number;
  expansionStepKm: number;
  maxRadiusKm: number;
  minCoverageRatio: number;
  minAcceptedOffersBeforeExpansion: number;
};

const DEFAULT_BROADCAST_POLICY: BroadcastPolicy = {
  initialRadiusKm: 10,
  expansionIntervalMinutes: 3,
  expansionStepKm: 10,
  maxRadiusKm: 50,
  minCoverageRatio: 0.6,
  minAcceptedOffersBeforeExpansion: 3,
};

type Point = { lat: number; lng: number };
type StockFlag = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asPolicyNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asPolicyInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.trunc(asPolicyNumber(value, fallback, min, max));
}

function readDelegate(name: string) {
  return (prisma as any)[name] || null;
}

function normalizeBroadcastPolicy(input: any): BroadcastPolicy {
  return {
    initialRadiusKm: asPolicyNumber(input?.initialRadiusKm, DEFAULT_BROADCAST_POLICY.initialRadiusKm, 1, 50),
    expansionIntervalMinutes: asPolicyNumber(input?.expansionIntervalMinutes, DEFAULT_BROADCAST_POLICY.expansionIntervalMinutes, 1, 60),
    expansionStepKm: asPolicyNumber(input?.expansionStepKm, DEFAULT_BROADCAST_POLICY.expansionStepKm, 1, 50),
    maxRadiusKm: asPolicyNumber(input?.maxRadiusKm, DEFAULT_BROADCAST_POLICY.maxRadiusKm, 1, 100),
    minCoverageRatio: asPolicyNumber(input?.minCoverageRatio, DEFAULT_BROADCAST_POLICY.minCoverageRatio, 0, 1),
    minAcceptedOffersBeforeExpansion: asPolicyInt(
      input?.minAcceptedOffersBeforeExpansion,
      DEFAULT_BROADCAST_POLICY.minAcceptedOffersBeforeExpansion,
      1,
      20,
    ),
  };
}

async function loadBroadcastPolicy(orgId: string): Promise<{ policy: BroadcastPolicy; source: 'database' | 'defaults' }> {
  const settingsDelegate =
    readDelegate('carePortOperationalSetting') ||
    readDelegate('carePortSetting') ||
    readDelegate('careportSetting');

  if (!settingsDelegate?.findFirst) {
    return { policy: DEFAULT_BROADCAST_POLICY, source: 'defaults' };
  }

  const row = await settingsDelegate.findFirst({
    where: { orgId, key: 'careport.dispatch_policy' },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => null);

  const raw = row?.value ?? row?.json ?? row?.payload ?? row?.metadata ?? null;
  if (!raw || typeof raw !== 'object') {
    return { policy: DEFAULT_BROADCAST_POLICY, source: 'defaults' };
  }

  return {
    policy: normalizeBroadcastPolicy((raw as any).broadcastPolicy ?? raw),
    source: 'database',
  };
}

function clampRadius(value: number, policy: BroadcastPolicy): number {
  return Math.max(policy.initialRadiusKm, Math.min(policy.maxRadiusKm, Math.ceil(value)));
}

function normalizeText(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: unknown): string[] {
  const stop = new Set([
    "mg",
    "mcg",
    "g",
    "ml",
    "tablet",
    "tablets",
    "tab",
    "tabs",
    "capsule",
    "capsules",
    "cap",
    "caps",
    "syrup",
    "solution",
    "cream",
    "ointment",
    "injection",
    "oral",
  ]);

  return normalizeText(value)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 3 && !stop.has(x));
}

function hasUsableCoordinate(value: unknown): boolean {
  return Number.isFinite(Number(value));
}

function computeAutomaticRadiusKm(args: {
  startedAt: Date | null;
  now: Date;
  respondedCount: number;
  policy: BroadcastPolicy;
}): number {
  const { startedAt, now, respondedCount, policy } = args;
  if (!startedAt) return policy.initialRadiusKm;

  // If enough pharmacies have already responded, do not keep expanding automatically.
  // Manual patient/admin expansion can still override this via requestedRadiusKm/searchMore.
  if (respondedCount >= policy.minAcceptedOffersBeforeExpansion) return policy.initialRadiusKm;

  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const intervalMs = Math.max(60_000, policy.expansionIntervalMinutes * 60_000);
  const expansionSteps = Math.floor(elapsedMs / intervalMs);
  return clampRadius(policy.initialRadiusKm + expansionSteps * policy.expansionStepKm, policy);
}

function itemMatchesSku(item: any, sku: any): boolean {
  const itemCode = cleanString(item?.drugCode).toLowerCase();
  const skuCode = cleanString(sku?.drugCode).toLowerCase();

  if (itemCode && skuCode && itemCode === skuCode) return true;

  const itemName = normalizeText(item?.name);
  const skuName = normalizeText(sku?.name);
  if (!itemName || !skuName) return false;

  if (itemName.includes(skuName) || skuName.includes(itemName)) return true;

  const itemTokens = meaningfulTokens(item?.name);
  const skuTokens = new Set(meaningfulTokens(sku?.name));
  if (!itemTokens.length || !skuTokens.size) return false;

  const overlap = itemTokens.filter((token) => skuTokens.has(token)).length;
  return overlap >= Math.min(2, itemTokens.length);
}

function estimateCoverageForPharmacy(args: {
  items: any[];
  skus: any[];
  links: any[];
  minCoverageRatio: number;
}) {
  const { items, skus, links, minCoverageRatio } = args;
  const activeSkus = skus.filter((sku) => sku?.isActive !== false);
  const skuById = new Map(activeSkus.map((sku) => [String(sku.id), sku]));

  const genericsByOriginal = new Map<string, any[]>();
  for (const link of links) {
    const originalSkuId = cleanString(link?.originalSkuId);
    const genericSkuId = cleanString(link?.genericSkuId);
    const generic = skuById.get(genericSkuId);
    if (!originalSkuId || !generic) continue;
    const list = genericsByOriginal.get(originalSkuId) ?? [];
    list.push(generic);
    genericsByOriginal.set(originalSkuId, list);
  }

  const lineCoverage = items.map((item) => {
    const direct = activeSkus.filter((sku) => itemMatchesSku(item, sku));
    const original = direct.filter((sku) => !sku.isGeneric);
    const directGeneric = direct.filter((sku) => sku.isGeneric);

    const linkedGeneric = original.flatMap((sku) => genericsByOriginal.get(String(sku.id)) ?? []);
    const all = [...original, ...directGeneric, ...linkedGeneric];
    const unique = Array.from(new Map(all.map((sku) => [String(sku.id), sku])).values());

    let stockFlag: StockFlag = "UNAVAILABLE";
    if (original.length > 0) stockFlag = "AVAILABLE";
    else if (unique.length > 0) stockFlag = "PARTIAL";

    return {
      orderItemId: String(item.id),
      name: String(item.name ?? ""),
      matched: unique.length > 0,
      originalMatched: original.length > 0,
      genericMatched: unique.some((sku) => Boolean(sku.isGeneric)),
      stockFlag,
      optionCount: unique.length,
      cheapestPriceCents: unique.length
        ? Math.min(...unique.map((sku) => Number(sku.priceCents || 0)).filter((n) => Number.isFinite(n)))
        : null,
    };
  });

  const total = Math.max(1, items.length);
  const matchedCount = lineCoverage.filter((line) => line.matched).length;
  const originalCount = lineCoverage.filter((line) => line.originalMatched).length;
  const coverageRatio = matchedCount / total;

  return {
    totalItemCount: items.length,
    matchedCount,
    originalCount,
    coverageRatio,
    coveragePercent: Math.round(coverageRatio * 100),
    isFullCoverage: items.length > 0 && matchedCount === items.length,
    invitationClass:
      items.length > 0 && matchedCount === items.length
        ? "FULL"
        : coverageRatio >= minCoverageRatio
          ? "PARTIAL_CAPABLE"
          : "INSUFFICIENT",
    lineCoverage,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "clinician", "patient"]);

    const orderId = cleanString(params.orderId);
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedRadius = asFiniteNumber(body?.radiusKm ?? body?.requestedRadiusKm);
    const searchMore = Boolean(body?.searchMore || body?.expandSearch || body?.manualExpansion);
    const now = new Date();
    const { policy, source: policySource } = await loadBroadcastPolicy(orgId);

    const order = await prisma.carePortOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }

    if (!order.items.length) {
      return NextResponse.json({ ok: false, error: "order_has_no_items" }, { status: 409 });
    }

    if (order.fulfillment === "DELIVERY") {
      if (!hasUsableCoordinate(order.destinationLat) || !hasUsableCoordinate(order.destinationLng)) {
        return NextResponse.json(
          { ok: false, error: "destination_required_for_delivery" },
          { status: 400 },
        );
      }
    }

    const respondedCount = await prisma.carePortOffer.count({
      where: { orderId, orgId, status: "ACCEPTED" },
    });

    const automaticRadius = computeAutomaticRadiusKm({
      startedAt: order.broadcastStartedAt ?? null,
      now,
      respondedCount,
      policy,
    });
    const radiusKm = clampRadius(
      requestedRadius != null
        ? requestedRadius
        : searchMore
          ? automaticRadius + policy.expansionStepKm
          : automaticRadius,
      policy,
    );

    const mode = order.fulfillment;
    const origin: Point | null =
      hasUsableCoordinate(order.destinationLat) && hasUsableCoordinate(order.destinationLng)
        ? { lat: Number(order.destinationLat), lng: Number(order.destinationLng) }
        : null;

    const pharmacies = await prisma.pharmacyPartner.findMany({
      where: {
        active: true,
        ...(mode === "DELIVERY" ? { supportsDelivery: true } : { supportsPickup: true }),
        lat: { not: null },
        lng: { not: null },
        country: { not: "" },
        currency: { not: "" },
      },
      include: {
        careportSkus: { where: { orgId, isActive: true } },
        careportGenericLinks: { where: { orgId } },
      },
    });

    const scored = pharmacies
      .map((pharmacy) => {
        const pharmacyPoint = { lat: Number(pharmacy.lat), lng: Number(pharmacy.lng) };
        const distanceKm = origin ? haversineKm(origin, pharmacyPoint) : 0;
        const coverage = estimateCoverageForPharmacy({
          items: order.items,
          skus: (pharmacy as any).careportSkus ?? [],
          links: (pharmacy as any).careportGenericLinks ?? [],
          minCoverageRatio: policy.minCoverageRatio,
        });

        return {
          pharmacy,
          distanceKm,
          coverage,
          eligible:
            distanceKm <= radiusKm &&
            coverage.coverageRatio >= policy.minCoverageRatio &&
            coverage.totalItemCount > 0,
        };
      })
      .sort((a, b) => {
        if (a.coverage.isFullCoverage !== b.coverage.isFullCoverage) {
          return a.coverage.isFullCoverage ? -1 : 1;
        }
        if (b.coverage.coverageRatio !== a.coverage.coverageRatio) {
          return b.coverage.coverageRatio - a.coverage.coverageRatio;
        }
        return a.distanceKm - b.distanceKm;
      });

    const eligible = scored.filter((row) => row.eligible);

    const updated = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.carePortOrder.update({
        where: { id: orderId },
        data: {
          status: "OFFERS_OPEN",
          broadcastStartedAt: order.broadcastStartedAt ?? now,
          maxBroadcastKm: policy.maxRadiusKm,
        },
      });

      if (eligible.length) {
        await tx.carePortOffer.createMany({
          data: eligible.map(({ pharmacy }) => ({
            orgId,
            orderId,
            pharmacyId: pharmacy.id,
            status: "INVITED",
            currency: pharmacy.currency,
          })),
          skipDuplicates: true,
        });
      }

      await tx.auditEvent.create({
        data: {
          kind: "careport_broadcast_started",
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: orderId,
          meta: {
            correlationId,
            orgId,
            radiusKm,
            maxRadiusKm: policy.maxRadiusKm,
            initialRadiusKm: policy.initialRadiusKm,
            expansionStepKm: policy.expansionStepKm,
            expansionIntervalMinutes: policy.expansionIntervalMinutes,
            invited: eligible.length,
            respondedCount,
            lowResponseThreshold: policy.minAcceptedOffersBeforeExpansion,
            minCoverageRatio: policy.minCoverageRatio,
            policySource,
            mode,
            searchMore,
            candidates: scored.slice(0, 50).map((row) => ({
              pharmacyId: row.pharmacy.id,
              distanceKm: Number(row.distanceKm.toFixed(2)),
              coveragePercent: row.coverage.coveragePercent,
              invitationClass: row.coverage.invitationClass,
              eligible: row.eligible,
            })),
          },
        },
      });

      return nextOrder;
    });

    return NextResponse.json(
      {
        ok: true,
        order: updated,
        invitedCount: eligible.length,
        respondedCount,
        radiusKm,
        maxKm: policy.maxRadiusKm,
        searchMoreAvailable: radiusKm < policy.maxRadiusKm,
        policy: {
          ...policy,
          source: policySource,
          preferredCoverage: "100%",
          partialCapableCoverage: `${Math.round(policy.minCoverageRatio * 100)}-99%`,
          excludedCoverage: `<${Math.round(policy.minCoverageRatio * 100)}%`,
        },
        invited: eligible.map((row) => ({
          pharmacyId: row.pharmacy.id,
          pharmacyName: row.pharmacy.name,
          distanceKm: Number(row.distanceKm.toFixed(2)),
          coveragePercent: row.coverage.coveragePercent,
          invitationClass: row.coverage.invitationClass,
        })),
      },
      { status: 200, headers: { "access-control-allow-origin": "*" } },
    );
  } catch (e: any) {
    const status = e?.status || 500;

    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "error",
        correlationId,
      },
      { status },
    );
  }
}
