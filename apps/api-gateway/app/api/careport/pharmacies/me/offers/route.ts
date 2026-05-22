// apps/api-gateway/app/api/careport/pharmacies/me/offers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole, haversineKm } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: unknown): string[] {
  const stop = new Set(["mg", "mcg", "g", "ml", "tablet", "tablets", "capsule", "capsules", "oral", "syrup"]);
  return normalizeText(value)
    .split(" ")
    .filter((x) => x.length >= 3 && !stop.has(x));
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
  const overlap = itemTokens.filter((token) => skuTokens.has(token)).length;
  return overlap >= Math.min(2, itemTokens.length || 2);
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = cleanString(req.nextUrl.searchParams.get("pharmacyId"));

  if (who.role === "admin" && explicit) return explicit;
  if (who.role === "pharmacy" && who.uid) return String(who.uid);

  if (who.role === "pharmacy_staff" && who.uid) {
    const pid = await pharmacyIdForStaff(orgId, who.uid);
    return pid ? String(pid) : null;
  }

  return null;
}

function estimateCoverage(items: any[], skus: any[]) {
  const active = skus.filter((sku) => sku?.isActive !== false);
  const lines = items.map((item) => {
    const matches = active.filter((sku) => itemMatchesSku(item, sku));
    const originals = matches.filter((sku) => !sku.isGeneric);
    const generics = matches.filter((sku) => sku.isGeneric);
    return {
      orderItemId: item.id,
      name: item.name,
      matched: matches.length > 0,
      originalMatched: originals.length > 0,
      genericMatched: generics.length > 0,
      optionCount: matches.length,
    };
  });

  const total = Math.max(1, items.length);
  const matchedCount = lines.filter((line) => line.matched).length;
  const coverageRatio = matchedCount / total;

  return {
    totalItemCount: items.length,
    matchedCount,
    coveragePercent: Math.round(coverageRatio * 100),
    isFullCoverage: items.length > 0 && matchedCount === items.length,
    invitationClass:
      items.length > 0 && matchedCount === items.length
        ? "FULL"
        : coverageRatio >= 0.6
          ? "PARTIAL_CAPABLE"
          : "INSUFFICIENT",
    lines,
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);

  const orgId = orgIdFromHeaders(req.headers);
  const pharmacyId = await resolvePharmacyId(req, who);

  if (!pharmacyId) {
    return NextResponse.json({ ok: false, error: "pharmacyId_unresolved" }, { status: 409 });
  }

  const statusParam = cleanString(req.nextUrl.searchParams.get("status") || "INVITED").toUpperCase();
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50)));
  const status = ["INVITED", "ACCEPTED", "DECLINED", "EXPIRED", "ALL"].includes(statusParam)
    ? statusParam
    : "INVITED";

  const pharmacy = await prisma.pharmacyPartner.findUnique({
    where: { id: pharmacyId },
    include: { careportSkus: { where: { orgId, isActive: true } } },
  });

  if (!pharmacy) {
    return NextResponse.json({ ok: false, error: "pharmacy_not_found" }, { status: 404 });
  }

  const offers = await prisma.carePortOffer.findMany({
    where: {
      orgId,
      pharmacyId,
      ...(status === "ALL" ? {} : { status: status as any }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      order: { include: { items: true } },
      lines: { include: { options: true } },
    },
  });

  const pharmacyPoint =
    pharmacy.lat != null && pharmacy.lng != null
      ? { lat: Number(pharmacy.lat), lng: Number(pharmacy.lng) }
      : null;

  const result = offers.map((offer) => {
    const order = offer.order;
    const destinationPoint =
      order.destinationLat != null && order.destinationLng != null
        ? { lat: Number(order.destinationLat), lng: Number(order.destinationLng) }
        : null;

    const distanceKm = pharmacyPoint && destinationPoint ? haversineKm(pharmacyPoint, destinationPoint) : null;
    const coverage = estimateCoverage(order.items, (pharmacy as any).careportSkus ?? []);

    return {
      offerId: offer.id,
      orderId: offer.orderId,
      pharmacyId: offer.pharmacyId,
      status: offer.status,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      acceptedAt: offer.acceptedAt,
      prepEtaMin: offer.prepEtaMin,
      isPartial: offer.isPartial,
      subtotalCents: offer.subtotalCents,
      currency: offer.currency,
      order: {
        id: order.id,
        status: order.status,
        fulfillment: order.fulfillment,
        encounterId: order.encounterId,
        destinationAddr: order.destinationAddr,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
      },
      orderItems: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        directions: item.directions ?? null,
        drugCode: item.drugCode ?? null,
      })),
      coverage,
      lines: offer.lines.map((line) => ({
        id: line.id,
        orderItemId: line.orderItemId,
        stockFlag: line.stockFlag,
        options: line.options.map((op) => ({
          skuId: op.skuId,
          isGeneric: op.isGeneric,
          priceCents: op.priceCents,
          currency: op.currency,
        })),
      })),
    };
  });

  return NextResponse.json(
    {
      ok: true,
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        address: pharmacy.address,
        city: pharmacy.city,
        country: pharmacy.country,
        currency: pharmacy.currency,
        kycStatus: pharmacy.kycStatus,
        supportsDelivery: pharmacy.supportsDelivery,
        supportsPickup: pharmacy.supportsPickup,
      },
      offers: result,
    },
    { status: 200, headers: { "access-control-allow-origin": "*" } },
  );
}
