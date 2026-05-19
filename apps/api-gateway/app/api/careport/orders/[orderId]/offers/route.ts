// FILE: apps/api-gateway/app/api/careport/orders/[orderId]/offers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import {
  correlationIdFromHeaders,
  getActivePricingRule,
  haversineKm,
  orgIdFromHeaders,
  requireRole,
} from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "clinician", "admin"]);

    const orderId = String(params.orderId || "").trim();
    if (!orderId) return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });

    const order = await prisma.carePortOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });

    const offers = await prisma.carePortOffer.findMany({
      where: { orderId, orgId, status: "ACCEPTED" },
      include: {
        pharmacy: true,
        lines: { include: { options: true } },
      },
    });

    const origin =
      Number.isFinite(order.destinationLat ?? NaN) && Number.isFinite(order.destinationLng ?? NaN)
        ? { lat: Number(order.destinationLat), lng: Number(order.destinationLng) }
        : null;

    const enriched = await Promise.all(
      offers.map(async (o) => {
        const p = o.pharmacy;

        const distKm =
          origin && p.lat != null && p.lng != null ? haversineKm(origin, { lat: Number(p.lat), lng: Number(p.lng) }) : null;

        let cheapestSubtotal = 0;
        let maxSubtotal = 0;

        for (const line of o.lines) {
          const item = order.items.find((x) => x.id === line.orderItemId);
          const qty = item?.quantity ?? 1;

          const prices = line.options.map((x) => x.priceCents);
          if (!prices.length) continue;

          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          cheapestSubtotal += minP * qty;
          maxSubtotal += maxP * qty;
        }

        const country = String((p as any).country || "ZA");
        const currency = String((p as any).currency || "ZAR");
        const rule = await getActivePricingRule({ orgId, country, currency });

        const deliveryFeeCents =
          order.fulfillment === "DELIVERY" && distKm != null
            ? Math.max(0, rule.baseFeeCents + Math.max(0, Math.ceil(distKm - rule.includedKm)) * rule.extraPerKmCents)
            : 0;

        const estTotalCheapest = cheapestSubtotal + deliveryFeeCents;
        const codAllowed = Boolean(p.acceptsCod) && rule.codEnabled && estTotalCheapest <= rule.codLimitCents;

        const travelMin = distKm != null ? Math.ceil((distKm / 25) * 60) : null;
        const prepMin = o.prepEtaMin ?? null;

        return {
          offerId: o.id,
          pharmacy: {
            id: p.id,
            name: p.name,
            address: p.address,
            city: p.city,
            lat: p.lat,
            lng: p.lng,
            country,
            currency,
            supportsPickup: p.supportsPickup,
            supportsDelivery: p.supportsDelivery,
            acceptsMedicalAid: p.acceptsMedicalAid,
            acceptedMedicalAids: p.acceptedMedicalAids,
            acceptsCard: p.acceptsCard,
            acceptsRcs: p.acceptsRcs,
            acceptsStoreCard: p.acceptsStoreCard,
            acceptsCod: codAllowed,
          },
          isPartial: o.isPartial,
          prepEtaMin: prepMin,
          distanceKm: distKm != null ? Number(distKm.toFixed(2)) : null,
          deliveryEtaMin: order.fulfillment === "DELIVERY" && travelMin != null ? (prepMin ?? 0) + travelMin : null,
          pricing: {
            currency,
            subtotalRangeCents: { min: cheapestSubtotal, max: maxSubtotal },
            deliveryFeeCents,
            totalCheapestCents: estTotalCheapest,
            codLimitCents: rule.codLimitCents,
          },
          lines: o.lines.map((l) => ({
            orderItemId: l.orderItemId,
            stockFlag: l.stockFlag,
            options: l.options.map((op) => ({
              skuId: op.skuId,
              isGeneric: op.isGeneric,
              priceCents: op.priceCents,
              currency: op.currency,
            })),
          })),
        };
      })
    );

    enriched.sort((a, b) => Number(a.isPartial) - Number(b.isPartial) || a.pricing.totalCheapestCents - b.pricing.totalCheapestCents);

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: order.id,
          status: order.status,
          fulfillment: order.fulfillment,
          destinationAddr: order.destinationAddr,
        },
        orderItems: order.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          directions: i.directions ?? null,
        })),
        acceptedCount: enriched.length,
        offers: enriched,
      },
      { status: 200, headers: { "access-control-allow-origin": "*" } }
    );
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "error", correlationId }, { status });
  }
}