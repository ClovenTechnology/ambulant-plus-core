import { PrismaTx, dbOrTx } from "./lib/prisma";
import { createBillableEvent } from "./billing";
import { softJsonHash } from "./lib/idempotency";

function asInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function ensureMedReachFinancialRecord(args: {
  orderId: string;
  drawId?: string | null;
  labId?: string | null;
  phlebId?: string | null;
  orgId?: string;
  tx?: PrismaTx;
}) {
  const db = dbOrTx(args.tx);

  const draw = args.drawId
    ? await db.draw.findUnique({ where: { id: args.drawId } })
    : await db.draw.findFirst({
        where: { orderId: args.orderId },
        orderBy: { createdAt: "desc" }
      });

  if (!draw) {
    throw new Error("draw_not_found");
  }

  const existing = await db.medReachOrderFinancial.findUnique({
    where: { orderId: args.orderId }
  });

  if (existing) {
    const updated = await db.medReachOrderFinancial.update({
      where: { orderId: args.orderId },
      data: {
        labId: args.labId ?? existing.labId,
        phlebId: args.phlebId ?? existing.phlebId
      }
    });

    return updated;
  }

  if (!args.labId) {
    return null;
  }

  return db.medReachOrderFinancial.create({
    data: {
      orderId: args.orderId,
      drawId: draw.id,
      labId: args.labId,
      phlebId: args.phlebId ?? null,
      clientId: (draw as any).clientId ?? null,
      clientMemberId: (draw as any).clientMemberId ?? null,
      coveragePlanId: (draw as any).coveragePlanId ?? null,
      authorizationId: (draw as any).coverageAuthorizationId ?? null,
      currency: "ZAR",
      subtotalCents: 0,
      logisticsFeeCents: 0,
      urgentSurchargeCents: 0,
      coldChainSurchargeCents: 0,
      platformFeeCents: 0,
      labGrossCents: 0,
      phlebGrossCents: 0,
      labNetCents: 0,
      phlebNetCents: 0,
      sponsorAmountMinor: 0,
      patientCopayMinor: 0,
      pricingSnapshot: {
        source: "medreach.assign",
        drawId: draw.id
      }
    }
  });
}

export async function buildMedReachBillableEventsFromOrder(orderId: string, tx?: PrismaTx) {
  const db = dbOrTx(tx);

  const draw = await db.draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" }
  });

  if (!draw) {
    throw new Error("draw_not_found_for_order");
  }

  const financial = await db.medReachOrderFinancial.findUnique({
    where: { orderId }
  });

  if (!financial) {
    throw new Error("medreach_financial_not_found");
  }

  const existing = await db.billableEvent.findMany({
    where: {
      drawId: draw.id,
      serviceType: {
        in: ["PHLEB_DRAW", "LAB_TEST", "LAB_LOGISTICS"]
      }
    }
  });

  if (existing.length > 0) {
    return existing;
  }

  const sponsorAmountMinor = Math.max(0, asInt((financial as any).sponsorAmountMinor, 0));
  const patientCopayMinor = Math.max(0, asInt((financial as any).patientCopayMinor, 0));

  const phlebGross = Math.max(0, asInt(financial.phlebGrossCents, 0));
  const labGross = Math.max(0, asInt(financial.labGrossCents, 0));
  const logisticsGross = Math.max(
    0,
    asInt(financial.logisticsFeeCents, 0) +
      asInt(financial.urgentSurchargeCents, 0) +
      asInt(financial.coldChainSurchargeCents, 0)
  );

  const totalGross = phlebGross + labGross + logisticsGross;

  const sponsorPhlebShare = totalGross > 0 ? Math.trunc((sponsorAmountMinor * phlebGross) / totalGross) : 0;
  const sponsorLabShare = totalGross > 0 ? Math.trunc((sponsorAmountMinor * labGross) / totalGross) : 0;
  const sponsorLogisticsShare = Math.max(0, sponsorAmountMinor - sponsorPhlebShare - sponsorLabShare);

  const patientPhlebShare = totalGross > 0 ? Math.trunc((patientCopayMinor * phlebGross) / totalGross) : 0;
  const patientLabShare = totalGross > 0 ? Math.trunc((patientCopayMinor * labGross) / totalGross) : 0;
  const patientLogisticsShare = Math.max(0, patientCopayMinor - patientPhlebShare - patientLabShare);

  const phlebEventIdemKey =
    phlebGross > 0 ? `medreach:${orderId}:phleb:${softJsonHash({
      drawId: draw.id,
      phlebGross,
      sponsorPhlebShare,
      patientPhlebShare,
      currency: financial.currency ?? "ZAR"
    })}` : null;

  const labEventIdemKey =
    labGross > 0 ? `medreach:${orderId}:lab:${softJsonHash({
      drawId: draw.id,
      labGross,
      sponsorLabShare,
      patientLabShare,
      labId: financial.labId,
      currency: financial.currency ?? "ZAR"
    })}` : null;

  const logisticsEventIdemKey =
    logisticsGross > 0 ? `medreach:${orderId}:logistics:${softJsonHash({
      drawId: draw.id,
      logisticsGross,
      sponsorLogisticsShare,
      patientLogisticsShare,
      partnerId: draw.partnerId ?? null,
      currency: financial.currency ?? "ZAR"
    })}` : null;

  const created: any[] = [];

  if (phlebGross > 0) {
    const evt = await createBillableEvent({
      orgId: (draw as any).orgId ?? "org-default",
      clientId: (financial as any).clientId ?? undefined,
      clientMemberId: (financial as any).clientMemberId ?? undefined,
      authorizationId: (financial as any).authorizationId ?? undefined,
      encounterId: draw.encounterId,
      drawId: draw.id,
      patientId: draw.patientId,
      serviceType: "PHLEB_DRAW",
      providerLane: "PHLEB",
      providerId: draw.phlebId ?? undefined,
      responsibility:
        sponsorPhlebShare > 0 && patientPhlebShare > 0
          ? "SPLIT"
          : sponsorPhlebShare > 0
            ? "CLIENT"
            : "PATIENT",
      currency: financial.currency ?? "ZAR",
      grossAmountMinor: phlebGross,
      sponsorAmountMinor: sponsorPhlebShare,
      patientAmountMinor: patientPhlebShare,
      platformAmountMinor: 0,
      providerAmountMinor: asInt(financial.phlebNetCents, phlebGross),
      pricingSnapshot: {
        source: "medreach.result",
        orderId,
        drawId: draw.id,
        role: "phleb",
        sponsorPricingSnapshot: (financial as any).sponsorPricingSnapshot ?? null
      },
      tx,
      idempotencyKey: phlebEventIdemKey
    });

    created.push(evt);

    await db.medReachOrderFinancial.update({
      where: { orderId },
      data: {
        billableEventPhlebId: evt.id
      }
    });
  }

  if (labGross > 0) {
    const evt = await createBillableEvent({
      orgId: (draw as any).orgId ?? "org-default",
      clientId: (financial as any).clientId ?? undefined,
      clientMemberId: (financial as any).clientMemberId ?? undefined,
      authorizationId: (financial as any).authorizationId ?? undefined,
      encounterId: draw.encounterId,
      drawId: draw.id,
      labOrderId: orderId,
      patientId: draw.patientId,
      serviceType: "LAB_TEST",
      providerLane: "LAB",
      providerId: financial.labId,
      responsibility:
        sponsorLabShare > 0 && patientLabShare > 0
          ? "SPLIT"
          : sponsorLabShare > 0
            ? "CLIENT"
            : "PATIENT",
      currency: financial.currency ?? "ZAR",
      grossAmountMinor: labGross,
      sponsorAmountMinor: sponsorLabShare,
      patientAmountMinor: patientLabShare,
      platformAmountMinor: 0,
      providerAmountMinor: asInt(financial.labNetCents, labGross),
      pricingSnapshot: {
        source: "medreach.result",
        orderId,
        drawId: draw.id,
        role: "lab",
        sponsorPricingSnapshot: (financial as any).sponsorPricingSnapshot ?? null
      },
      tx,
      idempotencyKey: labEventIdemKey
    });

    created.push(evt);

    await db.medReachOrderFinancial.update({
      where: { orderId },
      data: {
        billableEventLabId: evt.id
      }
    });
  }

  if (logisticsGross > 0) {
    const evt = await createBillableEvent({
      orgId: (draw as any).orgId ?? "org-default",
      clientId: (financial as any).clientId ?? undefined,
      clientMemberId: (financial as any).clientMemberId ?? undefined,
      authorizationId: (financial as any).authorizationId ?? undefined,
      encounterId: draw.encounterId,
      drawId: draw.id,
      patientId: draw.patientId,
      serviceType: "LAB_LOGISTICS",
      providerLane: "PLATFORM",
      providerId: draw.partnerId ?? undefined,
      responsibility:
        sponsorLogisticsShare > 0 && patientLogisticsShare > 0
          ? "SPLIT"
          : sponsorLogisticsShare > 0
            ? "CLIENT"
            : "PATIENT",
      currency: financial.currency ?? "ZAR",
      grossAmountMinor: logisticsGross,
      sponsorAmountMinor: sponsorLogisticsShare,
      patientAmountMinor: patientLogisticsShare,
      platformAmountMinor: logisticsGross,
      providerAmountMinor: 0,
      pricingSnapshot: {
        source: "medreach.result",
        orderId,
        drawId: draw.id,
        role: "logistics",
        sponsorPricingSnapshot: (financial as any).sponsorPricingSnapshot ?? null
      },
      tx,
      idempotencyKey: logisticsEventIdemKey
    });

    created.push(evt);

    await db.medReachOrderFinancial.update({
      where: { orderId },
      data: {
        billableEventLogisticsId: evt.id
      }
    });
  }

  return created;
}