import { PrismaTx, dbOrTx } from "./lib/prisma";
import { createBillableEvent } from "./billing";
import { softJsonHash } from "./lib/idempotency";

function asInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function buildCarePortBillableEventsFromOrder(orderId: string, tx?: PrismaTx) {
  const db = dbOrTx(tx);

  const order = await db.carePortOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true
    }
  });

  if (!order) {
    throw new Error("order_not_found");
  }

  const existing = await db.billableEvent.findMany({
    where: {
      carePortOrderId: order.id,
      serviceType: {
        in: ["PHARMACY_ITEM", "RIDER_DELIVERY"]
      }
    }
  });

  if (existing.length > 0) {
    return existing;
  }

  const delivery = await db.delivery.findFirst({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" }
  });

  const orderAny = order as any;

  const pharmacyGross = Math.max(0, asInt(order.subtotalCents, 0));
  const deliveryGross = Math.max(0, asInt(order.deliveryFeeCents, 0));
  const totalGross = pharmacyGross + deliveryGross;

  const sponsorAmountMinor = Math.max(0, asInt(orderAny.sponsorAmountMinor, 0));
  const patientCopayMinor = Math.max(
    0,
    asInt(orderAny.patientCopayMinor, Math.max(0, asInt(order.totalCents, 0) - sponsorAmountMinor))
  );

  const sponsorPharmacyShare =
    totalGross > 0 ? Math.trunc((sponsorAmountMinor * pharmacyGross) / totalGross) : 0;
  const sponsorDeliveryShare = Math.max(0, sponsorAmountMinor - sponsorPharmacyShare);

  const patientPharmacyShare =
    totalGross > 0 ? Math.trunc((patientCopayMinor * pharmacyGross) / totalGross) : 0;
  const patientDeliveryShare = Math.max(0, patientCopayMinor - patientPharmacyShare);

  const pharmacyEventIdemKey =
    pharmacyGross > 0 ? `careport:${order.id}:pharmacy:${softJsonHash({
      sponsorAmountMinor,
      patientCopayMinor,
      pharmacyGross,
      currency: order.currency ?? "ZAR"
    })}` : null;

  const deliveryEventIdemKey =
    deliveryGross > 0 ? `careport:${order.id}:delivery:${softJsonHash({
      sponsorAmountMinor,
      patientCopayMinor,
      deliveryGross,
      currency: order.currency ?? "ZAR",
      deliveryId: delivery?.id ?? null
    })}` : null;

  const created: any[] = [];

  if (pharmacyGross > 0) {
    const evt = await createBillableEvent({
      orgId: order.orgId,
      clientId: orderAny.clientId ?? undefined,
      clientMemberId: orderAny.clientMemberId ?? undefined,
      authorizationId: orderAny.coverageAuthorizationId ?? undefined,
      encounterId: order.encounterId,
      carePortOrderId: order.id,
      patientId: order.patientId,
      serviceType: "PHARMACY_ITEM",
      providerLane: "PHARMACY",
      providerId: order.chosenPharmacyId ?? undefined,
      responsibility:
        sponsorPharmacyShare > 0 && patientPharmacyShare > 0
          ? "SPLIT"
          : sponsorPharmacyShare > 0
            ? "CLIENT"
            : "PATIENT",
      currency: order.currency ?? "ZAR",
      grossAmountMinor: pharmacyGross,
      sponsorAmountMinor: sponsorPharmacyShare,
      patientAmountMinor: patientPharmacyShare,
      platformAmountMinor: 0,
      providerAmountMinor: pharmacyGross,
      pricingSnapshot: {
        source: "careport.checkout",
        orderId: order.id,
        itemCount: order.items.length,
        subtotalCents: order.subtotalCents,
        deliveryFeeCents: order.deliveryFeeCents,
        totalCents: order.totalCents,
        sponsorPricingSnapshot: orderAny.sponsorPricingSnapshot ?? null
      },
      tx,
      idempotencyKey: pharmacyEventIdemKey
    });

    created.push(evt);
  }

  if (deliveryGross > 0) {
    const evt = await createBillableEvent({
      orgId: order.orgId,
      clientId: orderAny.clientId ?? undefined,
      clientMemberId: orderAny.clientMemberId ?? undefined,
      authorizationId: orderAny.coverageAuthorizationId ?? undefined,
      encounterId: order.encounterId,
      carePortOrderId: order.id,
      deliveryId: delivery?.id ?? undefined,
      patientId: order.patientId,
      serviceType: "RIDER_DELIVERY",
      providerLane: "RIDER",
      providerId: delivery?.riderId ?? undefined,
      responsibility:
        sponsorDeliveryShare > 0 && patientDeliveryShare > 0
          ? "SPLIT"
          : sponsorDeliveryShare > 0
            ? "CLIENT"
            : "PATIENT",
      currency: order.currency ?? "ZAR",
      grossAmountMinor: deliveryGross,
      sponsorAmountMinor: sponsorDeliveryShare,
      patientAmountMinor: patientDeliveryShare,
      platformAmountMinor: 0,
      providerAmountMinor: deliveryGross,
      pricingSnapshot: {
        source: "careport.checkout",
        orderId: order.id,
        deliveryId: delivery?.id ?? null,
        fulfillment: order.fulfillment,
        sponsorPricingSnapshot: orderAny.sponsorPricingSnapshot ?? null
      },
      tx,
      idempotencyKey: deliveryEventIdemKey
    });

    created.push(evt);
  }

  return created;
}