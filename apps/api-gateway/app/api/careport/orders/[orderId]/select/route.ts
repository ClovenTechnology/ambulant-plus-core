//apps/api-gateway/app/api/careport/orders/[orderId]/select/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import {
  calcDeliveryFeeCents,
  correlationIdFromHeaders,
  ensureCurrency,
  getActivePricingRule,
  haversineKm,
  orgIdFromHeaders,
  requireRole,
} from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asBool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "admin"]);

    const orderId = String(params.orderId || "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId_required" }, { status: 400 });
    }

    const b = await req.json().catch(() => ({}));
    const offerId = String(b?.offerId ?? "").trim();
    const selections: Record<string, { chosenSkuId: string }> = (b?.selections ?? {}) as any;

    const allowPartialFulfillment = asBool(b?.allowPartialFulfillment, false);
    const allowGenericSubstitution = asBool(b?.allowGenericSubstitution, true);

    if (!offerId) {
      return NextResponse.json({ error: "offerId_required" }, { status: 400 });
    }

    const order = await prisma.carePortOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    const offer = await prisma.carePortOffer.findUnique({
      where: { id: offerId },
      include: {
        pharmacy: true,
        lines: { include: { options: true } },
      },
    });

    if (!offer || offer.orderId !== orderId) {
      return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
    }

    if (offer.status !== "ACCEPTED") {
      return NextResponse.json({ error: "offer_not_accepted" }, { status: 409 });
    }

    if (offer.isPartial && !allowPartialFulfillment) {
      return NextResponse.json(
        { error: "partial_offer_not_allowed_by_patient" },
        { status: 409 }
      );
    }

    const pharmacy = offer.pharmacy;
    if (!pharmacy.active) {
      return NextResponse.json({ error: "pharmacy_not_active" }, { status: 409 });
    }

    if (String((pharmacy as any).kycStatus || "").toUpperCase() !== "APPROVED" || !(pharmacy as any).kycVerifiedAt) {
      return NextResponse.json(
        { error: "pharmacy_not_kyc_approved", pharmacyId: pharmacy.id, kycStatus: (pharmacy as any).kycStatus || null },
        { status: 409 },
      );
    }
    if (!pharmacy.country || !pharmacy.currency) {
      return NextResponse.json({ error: "pharmacy_missing_country_or_currency" }, { status: 409 });
    }

    const orderItemIds = new Set(order.items.map((i) => i.id));
    for (const id of orderItemIds) {
      if (!selections[id]?.chosenSkuId) {
        return NextResponse.json(
          { error: "missing_selection_for_orderItemId", orderItemId: id },
          { status: 400 }
        );
      }
    }

    const priceByOrderItemId = new Map<
      string,
      { skuId: string; unitPriceCents: number; currency: string; isGeneric: boolean }
    >();

    for (const line of offer.lines) {
      const chosenSkuId = selections[line.orderItemId]?.chosenSkuId;
      if (!chosenSkuId) continue;

      const opt = line.options.find((o) => o.skuId === chosenSkuId);
      if (!opt) {
        return NextResponse.json(
          {
            error: "chosenSkuId_not_in_offer_options",
            orderItemId: line.orderItemId,
            chosenSkuId,
          },
          { status: 400 }
        );
      }

      if (opt.isGeneric && !allowGenericSubstitution) {
        return NextResponse.json(
          {
            error: "generic_substitution_not_allowed_by_patient",
            orderItemId: line.orderItemId,
            chosenSkuId,
          },
          { status: 409 }
        );
      }

      ensureCurrency(pharmacy.currency!, opt.currency, `offer_option:${opt.skuId}`);

      priceByOrderItemId.set(line.orderItemId, {
        skuId: opt.skuId,
        unitPriceCents: opt.priceCents,
        currency: opt.currency,
        isGeneric: Boolean(opt.isGeneric),
      });
    }

    const rule = await getActivePricingRule({
      orgId,
      country: pharmacy.country,
      currency: pharmacy.currency,
    });

    const origin =
      pharmacy.lat != null && pharmacy.lng != null
        ? { lat: Number(pharmacy.lat), lng: Number(pharmacy.lng) }
        : null;

    const dest =
      order.fulfillment === "DELIVERY"
        ? Number.isFinite(order.destinationLat ?? NaN) &&
          Number.isFinite(order.destinationLng ?? NaN)
          ? { lat: Number(order.destinationLat), lng: Number(order.destinationLng) }
          : null
        : null;

    if (order.fulfillment === "DELIVERY" && (!origin || !dest)) {
      return NextResponse.json(
        { error: "missing_origin_or_destination_coords_for_delivery" },
        { status: 409 }
      );
    }

    const distanceKm = origin && dest ? haversineKm(origin, dest) : 0;

    let subtotalCents = 0;
    const selectionSnapshot: Array<{
      orderItemId: string;
      quantity: number;
      chosenSkuId: string;
      unitPriceCents: number;
      isGeneric: boolean;
    }> = [];

    for (const item of order.items) {
      const chosen = priceByOrderItemId.get(item.id);
      if (!chosen) continue;

      subtotalCents += chosen.unitPriceCents * item.quantity;

      selectionSnapshot.push({
        orderItemId: item.id,
        quantity: item.quantity,
        chosenSkuId: chosen.skuId,
        unitPriceCents: chosen.unitPriceCents,
        isGeneric: chosen.isGeneric,
      });
    }

    const deliveryFeeCents =
      order.fulfillment === "DELIVERY" ? calcDeliveryFeeCents(rule, distanceKm) : 0;
    const totalCents = subtotalCents + deliveryFeeCents;

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const chosen = priceByOrderItemId.get(item.id)!;

        await tx.carePortSelection.upsert({
          where: { orderId_orderItemId: { orderId, orderItemId: item.id } },
          update: {
            chosenSkuId: chosen.skuId,
            unitPriceCents: chosen.unitPriceCents,
            currency: chosen.currency,
          },
          create: {
            orgId,
            orderId,
            orderItemId: item.id,
            chosenSkuId: chosen.skuId,
            unitPriceCents: chosen.unitPriceCents,
            currency: chosen.currency,
          },
        });
      }

      const o = await tx.carePortOrder.update({
        where: { id: orderId },
        data: {
          chosenPharmacyId: pharmacy.id,
          chosenOfferId: offer.id,
          currency: pharmacy.currency!,
          subtotalCents,
          deliveryFeeCents,
          totalCents,
          status: "PAYMENT_PENDING",
          sponsorPricingSnapshot: {
            selectionPolicy: {
              allowPartialFulfillment,
              allowGenericSubstitution,
            },
            selectionSnapshot,
            pricingAtSelection: {
              subtotalCents,
              deliveryFeeCents,
              totalCents,
              distanceKm,
              pricingRuleId: (rule as any)?.id ?? null,
            },
          } as any,
        },
      });

      await tx.auditEvent.create({
        data: {
          kind: "careport_pharmacy_selected",
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: orderId,
          meta: {
            correlationId,
            orgId,
            offerId,
            pharmacyId: pharmacy.id,
            country: pharmacy.country,
            currency: pharmacy.currency,
            subtotalCents,
            deliveryFeeCents,
            totalCents,
            distanceKm,
            allowPartialFulfillment,
            allowGenericSubstitution,
          },
        },
      });

      return o;
    });

    return NextResponse.json(
      { ok: true, order: updated },
      { status: 200, headers: { "access-control-allow-origin": "*" } }
    );
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json(
      { ok: false, error: e?.message || "error", correlationId },
      { status }
    );
  }
}