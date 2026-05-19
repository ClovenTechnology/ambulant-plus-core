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

function computeRadiusKm(startedAt: Date, now: Date): number {
  const elapsedMs = now.getTime() - startedAt.getTime();
  const steps = Math.max(0, Math.floor(elapsedMs / 10_000)); // every 10s
  return 5 + steps * 5;
}

function hasUsableCoordinate(value: unknown): boolean {
  return Number.isFinite(Number(value));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "clinician", "patient"]); // allow push-triggered broadcast in dev

    const orderId = String(params.orderId || "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId_required" }, { status: 400 });
    }

    const now = new Date();

    const order = await prisma.carePortOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    if (order.fulfillment === "DELIVERY") {
      if (
        !hasUsableCoordinate(order.destinationLat) ||
        !hasUsableCoordinate(order.destinationLng)
      ) {
        return NextResponse.json(
          { error: "destination_required_for_delivery" },
          { status: 400 },
        );
      }
    }

    const startedAt = order.broadcastStartedAt ?? now;
    const maxKm = order.maxBroadcastKm || 50;

    let radiusKm = Math.min(maxKm, computeRadiusKm(startedAt, now));
    if (!order.broadcastStartedAt) {
      radiusKm = 5;
    }

    const mode = order.fulfillment;

    const pharmacies = await prisma.pharmacyPartner.findMany({
      where: {
        active: true,
        ...(mode === "DELIVERY" ? { supportsDelivery: true } : { supportsPickup: true }),
        lat: { not: null },
        lng: { not: null },

        // country/currency are non-nullable strings in the generated Prisma type.
        // Exclude empty strings instead of using `{ not: null }`.
        country: { not: "" },
        currency: { not: "" },
      },
    });

    const origin =
      order.fulfillment === "DELIVERY"
        ? {
            lat: Number(order.destinationLat),
            lng: Number(order.destinationLng),
          }
        : hasUsableCoordinate(order.destinationLat) &&
            hasUsableCoordinate(order.destinationLng)
          ? {
              lat: Number(order.destinationLat),
              lng: Number(order.destinationLng),
            }
          : null;

    const withDist = pharmacies
      .map((p) => ({
        p,
        distKm: origin
          ? haversineKm(origin, {
              lat: Number(p.lat),
              lng: Number(p.lng),
            })
          : 999,
      }))
      .sort((a, b) => a.distKm - b.distKm);

    let selected = withDist.filter((x) => x.distKm <= radiusKm);

    while (selected.length < 10 && radiusKm < maxKm) {
      radiusKm = Math.min(maxKm, radiusKm + 5);
      selected = withDist.filter((x) => x.distKm <= radiusKm);
    }

    const chosen = selected.slice(0, 10);

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.carePortOrder.update({
        where: { id: orderId },
        data: {
          status: "OFFERS_OPEN",
          broadcastStartedAt: order.broadcastStartedAt ?? now,
        },
      });

      if (chosen.length) {
        await tx.carePortOffer.createMany({
          data: chosen.map(({ p }) => ({
            orgId,
            orderId,
            pharmacyId: p.id,
            status: "INVITED",
            currency: p.currency,
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
            invited: chosen.length,
            mode,
          },
        },
      });

      return o;
    });

    return NextResponse.json(
      {
        ok: true,
        order: updated,
        invitedCount: chosen.length,
        radiusKm,
        maxKm,
      },
      {
        status: 200,
        headers: { "access-control-allow-origin": "*" },
      },
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