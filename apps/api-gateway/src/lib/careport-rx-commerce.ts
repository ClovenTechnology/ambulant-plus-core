import { prisma } from "@/src/lib/db";
import {
  auditEvent,
  correlationIdFromHeaders,
  orgIdFromHeaders,
  requireCarePortPatientResourceAccess,
} from "@/src/lib/careport";
import { getCarePortProcurementById } from "@/src/lib/careport-rx-procurement";
import { readIdentity } from "@/src/lib/identity";
import { beginCheckout, verifyCheckout } from "@/src/payments/checkout-core";
import { getProvider } from "@/src/payments";
import { runCoveragePreflight } from "@ambulant/client-core/src/preflight";

type Who = ReturnType<typeof readIdentity>;

const RESERVATION_TTL_MS = 15 * 60 * 1000;
const SECURED_RESERVATION_TTL_MS = 6 * 60 * 60 * 1000;
const TERMINAL_ORDER_STATUSES = new Set(["CANCELLED", "EXPIRED"]);
const ACTIVE_RESERVATION_STATUSES = new Set(["HELD", "SECURED"]);
const CAPTURED_PAYMENT_STATUSES = new Set(["CAPTURED", "SUCCEEDED"]);

function clean(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function asPositiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeUnit(value: unknown): string {
  const raw = clean(value, 80)
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    pack: "pack",
    packs: "pack",
    packet: "pack",
    packets: "pack",
    box: "pack",
    boxes: "pack",
    tablet: "tablet",
    tablets: "tablet",
    tab: "tablet",
    tabs: "tablet",
    capsule: "capsule",
    capsules: "capsule",
    cap: "capsule",
    caps: "capsule",
    ml: "ml",
    millilitre: "ml",
    millilitres: "ml",
    milliliter: "ml",
    milliliters: "ml",
    unit: "unit",
    units: "unit",
    dose: "dose",
    doses: "dose",
    inhaler: "inhaler",
    inhalers: "inhaler",
    sachet: "sachet",
    sachets: "sachet",
    ampoule: "ampoule",
    ampoules: "ampoule",
    vial: "vial",
    vials: "vial",
  };

  return aliases[raw] || raw;
}

function taxBreakdown(args: {
  unitPriceCents: number;
  packs: number;
  taxRateBps: number;
  priceIncludesTax: boolean;
}) {
  const totalListed = Math.max(0, Math.trunc(args.unitPriceCents)) * Math.max(1, args.packs);
  const rate = Math.max(0, Math.min(10_000, Math.trunc(args.taxRateBps)));

  if (args.priceIncludesTax) {
    const tax = rate > 0 ? Math.round((totalListed * rate) / (10_000 + rate)) : 0;
    return {
      netCents: totalListed - tax,
      taxCents: tax,
      grossCents: totalListed,
    };
  }

  const tax = rate > 0 ? Math.round((totalListed * rate) / 10_000) : 0;
  return {
    netCents: totalListed,
    taxCents: tax,
    grossCents: totalListed + tax,
  };
}

function requiredPacks(line: any, sku: any) {
  const priceBasis = clean(sku?.rxPriceBasis, 20).toUpperCase();
  if (priceBasis !== "PACK") {
    throw Object.assign(new Error("rx_price_basis_pack_required"), {
      status: 409,
      details: { skuId: sku?.id, rxPriceBasis: sku?.rxPriceBasis ?? null },
    });
  }

  const unitsPerPack = asPositiveInt(sku?.rxUnitsPerPack);
  const dispenseUnit = normalizeUnit(sku?.rxDispenseUnit);
  const prescribedValue = asPositiveNumber(line?.prescribedQuantityValue);
  const prescribedUnit = normalizeUnit(line?.prescribedQuantityUnit);

  if (!unitsPerPack || !dispenseUnit) {
    throw Object.assign(new Error("rx_pack_unit_metadata_required"), {
      status: 409,
      details: {
        skuId: sku?.id,
        rxUnitsPerPack: sku?.rxUnitsPerPack ?? null,
        rxDispenseUnit: sku?.rxDispenseUnit ?? null,
      },
    });
  }

  if (prescribedValue && prescribedUnit) {
    if (prescribedUnit === "pack") {
      return {
        prescribedValue,
        prescribedUnit,
        unitsPerPack,
        dispenseUnit,
        packs: Math.max(1, Math.ceil(prescribedValue)),
        quantityAuthority: "STRUCTURED_PRESCRIBED_PACK_QUANTITY",
      };
    }

    if (prescribedUnit !== dispenseUnit) {
      throw Object.assign(new Error("prescribed_quantity_unit_incompatible_with_sku"), {
        status: 409,
        details: {
          lineId: line?.id,
          skuId: sku?.id,
          prescribedQuantityUnit: line?.prescribedQuantityUnit ?? null,
          rxDispenseUnit: sku?.rxDispenseUnit ?? null,
        },
      });
    }

    return {
      prescribedValue,
      prescribedUnit,
      unitsPerPack,
      dispenseUnit,
      packs: Math.max(1, Math.ceil(prescribedValue / unitsPerPack)),
      quantityAuthority: "STRUCTURED_PRESCRIBED_UNIT_QUANTITY",
    };
  }

  const legacyQuantity = asPositiveInt(line?.legacyQuantity);
  if (legacyQuantity && unitsPerPack === 1 && dispenseUnit === "unit") {
    return {
      prescribedValue: legacyQuantity,
      prescribedUnit: "unit",
      unitsPerPack,
      dispenseUnit,
      packs: legacyQuantity,
      quantityAuthority: "LEGACY_QUANTITY_WITH_EXPLICIT_ONE_UNIT_PACK",
    };
  }

  throw Object.assign(new Error("prescribed_quantity_basis_unresolved"), {
    status: 409,
    details: {
      lineId: line?.id,
      prescribedQuantityValue: line?.prescribedQuantityValue ?? null,
      prescribedQuantityUnit: line?.prescribedQuantityUnit ?? null,
      legacyQuantity: line?.legacyQuantity ?? null,
      skuId: sku?.id,
    },
  });
}

function safeSnapshot(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

export function serializeCarePortRxReservation(reservation: any) {
  if (!reservation) return null;

  return {
    id: reservation.id,
    sessionId: reservation.sessionId,
    orderId: reservation.orderId,
    quoteId: reservation.quoteId ?? null,
    pharmacyId: reservation.pharmacyId,
    status: reservation.status,
    fulfillment: reservation.fulfillment,
    destination: reservation.destinationAddr
      ? {
          address: reservation.destinationAddr,
          lat: reservation.destinationLat ?? null,
          lng: reservation.destinationLng ?? null,
        }
      : null,
    pricing: {
      subtotalNetCents: reservation.subtotalNetCents,
      taxCents: reservation.taxCents,
      subtotalGrossCents: reservation.subtotalGrossCents,
      deliveryFeeCents: reservation.deliveryFeeCents,
      totalCents: reservation.totalCents,
      claimableSubtotalCents: reservation.claimableSubtotalCents,
      sponsorAmountMinor: reservation.sponsorAmountMinor,
      patientGapMinor: reservation.patientGapMinor,
      currency: reservation.currency,
      authority: "TRANSACTION_GRADE_RESERVATION_SNAPSHOT",
    },
    expiresAt: reservation.expiresAt?.toISOString?.() ?? reservation.expiresAt,
    securedAt: reservation.securedAt?.toISOString?.() ?? reservation.securedAt ?? null,
    consumedAt: reservation.consumedAt?.toISOString?.() ?? reservation.consumedAt ?? null,
    releasedAt: reservation.releasedAt?.toISOString?.() ?? reservation.releasedAt ?? null,
    releaseReason: reservation.releaseReason ?? null,
    lines: Array.isArray(reservation.lines)
      ? reservation.lines.map((line: any) => ({
          id: line.id,
          procurementLineId: line.procurementLineId,
          quoteOptionId: line.quoteOptionId ?? null,
          skuId: line.skuId,
          globalProductId: line.globalProductId ?? null,
          globalProductKey: line.globalProductKey ?? null,
          prescribedQuantityValue: line.prescribedQuantityValue,
          prescribedQuantityUnit: line.prescribedQuantityUnit,
          requiredPacks: line.requiredPacks,
          unitsPerPack: line.unitsPerPack,
          dispenseUnit: line.dispenseUnit,
          unitListPriceCents: line.unitListPriceCents,
          priceBasis: line.priceBasis,
          taxRateBps: line.taxRateBps,
          priceIncludesTax: line.priceIncludesTax,
          netCents: line.netCents,
          taxCents: line.taxCents,
          grossCents: line.grossCents,
          medicalAidClaimable: Boolean(line.medicalAidClaimable),
        }))
      : [],
  };
}

export async function emitCarePortRxPharmacyEventTx(
  tx: any,
  args: {
    orgId: string;
    orderId: string;
    pharmacyId: string;
    kind: string;
    payload?: any;
    patientId?: string | null;
    encounterId?: string | null;
    clinicianId?: string | null;
  },
) {
  const event = await tx.carePortRxPharmacyEvent.create({
    data: {
      orgId: args.orgId,
      orderId: args.orderId,
      pharmacyId: args.pharmacyId,
      kind: clean(args.kind, 80),
      payload: safeSnapshot(args.payload),
    },
  });

  await tx.runtimeEvent
    ?.create?.({
      data: {
        ts: BigInt(Date.now()),
        kind: args.kind,
        encounterId: args.encounterId ?? null,
        patientId: args.patientId ?? null,
        clinicianId: args.clinicianId ?? null,
        targetPatientId: args.patientId ?? null,
        targetClinicianId: args.clinicianId ?? null,
        targetAdmin: false,
        orgId: args.orgId,
        payload: safeSnapshot({
          orderId: args.orderId,
          pharmacyId: args.pharmacyId,
          ...(asObject(args.payload)),
        }),
      },
    })
    .catch?.(() => null);

  return event;
}

async function clinicianIdForErx(tx: any, erxOrderId: string) {
  if (!erxOrderId) return null;
  const erx = await tx.erxOrder
    .findUnique({ where: { id: erxOrderId }, select: { clinicianId: true } })
    .catch(() => null);
  return clean(erx?.clinicianId, 191) || null;
}

async function releaseReservationStockTx(tx: any, reservation: any, reason: string) {
  if (!reservation || !ACTIVE_RESERVATION_STATUSES.has(String(reservation.status))) {
    return reservation;
  }

  const lines = Array.isArray(reservation.lines)
    ? reservation.lines
    : await tx.carePortRxReservationLine.findMany({ where: { reservationId: reservation.id } });

  for (const line of lines) {
    const qty = Math.max(1, Number(line.requiredPacks || 0));
    const result = await tx.carePortPharmacySku.updateMany({
      where: {
        id: line.skuId,
        reservedStock: { gte: qty },
      },
      data: {
        reservedStock: { decrement: qty },
      },
    });

    if (result.count !== 1) {
      throw Object.assign(new Error("rx_reservation_release_stock_invariant_failed"), {
        status: 409,
        details: { reservationId: reservation.id, skuId: line.skuId, qty },
      });
    }
  }

  return tx.carePortRxReservation.update({
    where: { id: reservation.id },
    data: {
      status: reason === "reservation_expired" ? "EXPIRED" : "RELEASED",
      releasedAt: new Date(),
      releaseReason: clean(reason, 120),
    },
    include: { lines: true },
  });
}

export async function consumeReservationStockTx(tx: any, reservation: any) {
  if (!reservation) {
    throw Object.assign(new Error("rx_reservation_required"), { status: 409 });
  }

  if (String(reservation.status) === "CONSUMED") return reservation;

  if (String(reservation.status) !== "SECURED") {
    throw Object.assign(new Error("rx_reservation_not_secured_for_consumption"), {
      status: 409,
      details: { reservationId: reservation.id, status: reservation.status },
    });
  }

  const lines = Array.isArray(reservation.lines)
    ? reservation.lines
    : await tx.carePortRxReservationLine.findMany({ where: { reservationId: reservation.id } });

  for (const line of lines) {
    const qty = Math.max(1, Number(line.requiredPacks || 0));

    const changed = await tx.$executeRawUnsafe(
      `UPDATE "CarePortPharmacySku"
       SET "reservedStock" = "reservedStock" - $1,
           "stockOnHand" = "stockOnHand" - $1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2
         AND "reservedStock" >= $1
         AND "stockOnHand" IS NOT NULL
         AND "stockOnHand" >= $1`,
      qty,
      line.skuId,
    );

    if (Number(changed) !== 1) {
      throw Object.assign(new Error("rx_reserved_stock_consumption_failed"), {
        status: 409,
        details: { reservationId: reservation.id, skuId: line.skuId, qty },
      });
    }
  }

  return tx.carePortRxReservation.update({
    where: { id: reservation.id },
    data: { status: "CONSUMED", consumedAt: new Date() },
    include: { lines: true },
  });
}

async function resetPendingReviewTx(tx: any, orgId: string, orderId: string) {
  return tx.carePortRxPharmacistReview.upsert({
    where: { orderId },
    update: {
      status: "PENDING",
      reasonCode: null,
      note: null,
      decidedBy: null,
      decidedAt: null,
    },
    create: {
      orgId,
      orderId,
      status: "PENDING",
    },
  });
}

async function reservationBundleForOrder(tx: any, orgId: string, orderId: string) {
  return tx.carePortOrder.findFirst({
    where: { id: orderId, orgId },
    include: {
      rxReservation: { include: { lines: true } },
      rxPharmacistReview: true,
      rxPharmacyFulfilment: true,
      rxDispenseLines: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

async function refundCapturedPaymentIfNeeded(args: {
  orgId: string;
  orderId: string;
  reason: string;
}) {
  const order = await (prisma as any).carePortOrder.findFirst({
    where: { id: args.orderId, orgId: args.orgId },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) {
    throw Object.assign(new Error("careport_order_not_found"), { status: 404 });
  }

  const captured = (order.payments || []).find((payment: any) =>
    CAPTURED_PAYMENT_STATUSES.has(String(payment.status)),
  );

  if (!captured) return null;

  const providerName = clean(captured.provider, 40).toLowerCase();
  if (providerName === "internal" || Number(captured.amountCents || 0) <= 0) {
    return { paymentId: captured.id, internal: true, refunded: false };
  }

  if (providerName !== "paystack") {
    throw Object.assign(new Error("canonical_rx_refund_provider_not_supported"), {
      status: 409,
      details: { provider: providerName || null, paymentIntentId: captured.id },
    });
  }

  const providerRef = clean(captured.providerRef, 191);
  if (!providerRef) {
    throw Object.assign(new Error("canonical_rx_refund_provider_reference_required"), {
      status: 409,
      details: { paymentIntentId: captured.id },
    });
  }

  const refund = await getProvider("paystack").refund(
    providerRef,
    Math.max(0, Number(captured.amountCents || 0)),
  );

  if (refund.status !== "refunded") {
    throw Object.assign(new Error("canonical_rx_refund_failed"), {
      status: 502,
      details: { paymentIntentId: captured.id, providerRef, refund: refund.meta ?? null },
    });
  }

  await (prisma as any).carePortPaymentIntent.update({
    where: { id: captured.id },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundProviderRef: clean(refund.providerRef, 191) || providerRef,
      refundStatus: "REFUNDED",
      metadata: {
        ...asObject(captured.metadata),
        canonicalRxRefund: {
          reason: args.reason,
          providerRef,
          refundedAt: new Date().toISOString(),
          providerMeta: safeSnapshot(refund.meta),
        },
      },
    },
  });

  return { paymentId: captured.id, internal: false, refunded: true };
}

export async function createCarePortRxReservation(args: {
  who: Who;
  orgId: string;
  correlationId: string;
  sessionId: string;
  body: any;
}) {
  const session = await getCarePortProcurementById({
    who: args.who,
    orgId: args.orgId,
    sessionId: args.sessionId,
  });

  if (!["BASKET_DRAFT", "PHARMACY_DISCOVERY", "PHARMACY_SELECTED", "RESERVED", "PAYMENT_PENDING"].includes(String(session.status))) {
    throw Object.assign(new Error("procurement_session_not_reservable"), {
      status: 409,
      details: { status: session.status },
    });
  }

  const fulfillment = clean(args.body?.fulfillment ?? "PICKUP", 20).toUpperCase();
  if (fulfillment !== "PICKUP") {
    throw Object.assign(new Error("canonical_rx_delivery_requires_wave_c"), {
      status: 409,
      details: { supportedFulfillment: ["PICKUP"] },
    });
  }

  const quoteId = clean(args.body?.quoteId, 191);
  const requested = Array.isArray(args.body?.selections) ? args.body.selections : [];

  if (!quoteId || !requested.length) {
    throw Object.assign(new Error("quote_and_selections_required"), { status: 400 });
  }

  const includedLines = (session.lines || []).filter((line: any) => String(line.state) === "INCLUDED");
  if (!includedLines.length) {
    throw Object.assign(new Error("no_included_prescription_lines"), { status: 409 });
  }

  const requestedByLine = new Map<string, string>();
  for (const row of requested) {
    const lineId = clean(row?.procurementLineId ?? row?.lineId, 191);
    const optionId = clean(row?.optionId ?? row?.quoteOptionId, 191);
    if (!lineId || !optionId || requestedByLine.has(lineId)) {
      throw Object.assign(new Error("invalid_or_duplicate_selection"), { status: 400 });
    }
    requestedByLine.set(lineId, optionId);
  }

  if (
    requestedByLine.size !== includedLines.length ||
    includedLines.some((line: any) => !requestedByLine.has(String(line.id)))
  ) {
    throw Object.assign(new Error("every_included_line_requires_one_selection"), {
      status: 409,
      details: { includedLineCount: includedLines.length, selectionCount: requestedByLine.size },
    });
  }

  const now = new Date();
  const quote = await (prisma as any).carePortRxPharmacyQuote.findFirst({
    where: {
      id: quoteId,
      sessionId: session.id,
      orgId: args.orgId,
      expiresAt: { gt: now },
    },
    include: {
      pharmacy: true,
      lines: { include: { options: true } },
    },
  });

  if (!quote) {
    throw Object.assign(new Error("rx_quote_not_found_or_expired"), { status: 409 });
  }

  if (String(quote.coverageStatus) !== "FULL") {
    throw Object.assign(new Error("full_coverage_quote_required_for_checkout"), {
      status: 409,
      details: { coverageStatus: quote.coverageStatus },
    });
  }

  if (!["AVAILABLE", "CONFIRMING"].includes(String(quote.availabilityState))) {
    throw Object.assign(new Error("pharmacy_not_currently_selectable"), {
      status: 409,
      details: { availabilityState: quote.availabilityState, reasonCode: quote.reasonCode ?? null },
    });
  }

  if (
    quote.pharmacy?.active === false ||
    String(quote.pharmacy?.kycStatus || "").toUpperCase() !== "APPROVED" ||
    !quote.pharmacy?.kycVerifiedAt ||
    quote.pharmacy?.acceptingRxOrders === false
  ) {
    throw Object.assign(new Error("pharmacy_not_eligible_for_rx_reservation"), { status: 409 });
  }

  const pauseUntil = quote.pharmacy?.rxOrderPauseUntil
    ? new Date(quote.pharmacy.rxOrderPauseUntil)
    : null;
  if (pauseUntil && pauseUntil.getTime() > now.getTime()) {
    throw Object.assign(new Error("pharmacy_rx_orders_paused"), {
      status: 409,
      details: { pauseUntil: pauseUntil.toISOString() },
    });
  }

  const quoteLineByProc = new Map<string, any>(
    (quote.lines || []).map((line: any) => [String(line.procurementLineId), line]),
  );

  const chosenOptions: any[] = [];
  for (const line of includedLines) {
    const quoteLine = quoteLineByProc.get(String(line.id));
    const optionId = requestedByLine.get(String(line.id));
    const option = (quoteLine?.options || []).find((row: any) => String(row.id) === optionId);

    if (!option || option.selectable !== true) {
      throw Object.assign(new Error("selected_quote_option_not_selectable"), {
        status: 409,
        details: { procurementLineId: line.id, optionId: optionId ?? null },
      });
    }

    chosenOptions.push({ line, quoteLine, option });
  }

  const skuIds = Array.from(new Set(chosenOptions.map((row) => String(row.option.skuId))));
  const skus = await (prisma as any).carePortPharmacySku.findMany({
    where: {
      id: { in: skuIds },
      orgId: args.orgId,
      pharmacyId: quote.pharmacyId,
      isActive: true,
      prescriptionRequired: true,
    },
  });

  const skuById = new Map<string, any>(skus.map((sku: any) => [String(sku.id), sku]));
  if (skuById.size !== skuIds.length) {
    throw Object.assign(new Error("one_or_more_selected_skus_no_longer_eligible"), { status: 409 });
  }

  const lineSnapshots = chosenOptions.map(({ line, option }) => {
    const sku = skuById.get(String(option.skuId));
    const quantity = requiredPacks(line, sku);
    const taxRateBps = Number(sku.rxTaxRateBps);

    if (!Number.isFinite(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) {
      throw Object.assign(new Error("rx_tax_rate_required"), {
        status: 409,
        details: { skuId: sku.id, rxTaxRateBps: sku.rxTaxRateBps ?? null },
      });
    }

    const unitListPriceCents = Math.max(0, Number(sku.priceCents || 0));
    if (!unitListPriceCents) {
      throw Object.assign(new Error("rx_live_price_required"), {
        status: 409,
        details: { skuId: sku.id },
      });
    }

    if (String(sku.currency || "ZAR") !== String(quote.currency || "ZAR")) {
      throw Object.assign(new Error("rx_quote_currency_changed"), {
        status: 409,
        details: { skuId: sku.id, skuCurrency: sku.currency, quoteCurrency: quote.currency },
      });
    }

    const breakdown = taxBreakdown({
      unitPriceCents: unitListPriceCents,
      packs: quantity.packs,
      taxRateBps,
      priceIncludesTax: Boolean(sku.rxPriceIncludesTax),
    });

    return {
      line,
      option,
      sku,
      quantity,
      taxRateBps: Math.trunc(taxRateBps),
      unitListPriceCents,
      ...breakdown,
    };
  });

  const totals = lineSnapshots.reduce(
    (acc, row) => {
      acc.net += row.netCents;
      acc.tax += row.taxCents;
      acc.gross += row.grossCents;
      if (row.sku.medicalAidClaimable) acc.claimable += row.grossCents;
      return acc;
    },
    { net: 0, tax: 0, gross: 0, claimable: 0 },
  );

  const currency = String(quote.currency || "ZAR");
  const reservationExpiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);

  const result = await (prisma as any).$transaction(
    async (tx: any) => {
      // Resolve/reconcile an existing canonical order BEFORE acquiring new stock.
      // This matters for a terminal retry because an old active reservation must
      // first release its reservedStock before the new live allocatable-stock
      // predicate is evaluated. All of this remains inside one Serializable tx.
      let order = await tx.carePortOrder.findUnique({
        where: {
          erxOrderId_refillNo: {
            erxOrderId: session.erxOrderId,
            refillNo: session.refillNo,
          },
        },
        include: {
          rxReservation: { include: { lines: true } },
          rxDispenseLines: true,
          payments: { orderBy: { createdAt: "desc" } },
        },
      });

      if (order) {
        const canonical = Boolean(order.procurementSessionId || order.rxReservation);
        if (!canonical) {
          throw Object.assign(new Error("existing_legacy_careport_order_conflicts_with_canonical_procurement"), {
            status: 409,
            details: { orderId: order.id, status: order.status },
          });
        }

        if (!TERMINAL_ORDER_STATUSES.has(String(order.status))) {
          throw Object.assign(new Error("existing_careport_order_is_not_reusable"), {
            status: 409,
            details: { orderId: order.id, status: order.status },
          });
        }

        if ((order.rxDispenseLines || []).length) {
          throw Object.assign(new Error("terminal_order_has_dispense_history_and_cannot_be_reused"), {
            status: 409,
            details: { orderId: order.id },
          });
        }

        const unsettledCapture = (order.payments || []).find((payment: any) =>
          CAPTURED_PAYMENT_STATUSES.has(String(payment.status)),
        );
        if (unsettledCapture) {
          throw Object.assign(new Error("previous_captured_payment_must_be_refunded_before_retry"), {
            status: 409,
            details: { orderId: order.id, paymentIntentId: unsettledCapture.id },
          });
        }

        if (order.rxReservation && ACTIVE_RESERVATION_STATUSES.has(String(order.rxReservation.status))) {
          await releaseReservationStockTx(tx, order.rxReservation, "terminal_order_reacquisition");
        }

        if (order.rxReservation) {
          await tx.carePortRxReservationLine.deleteMany({
            where: { reservationId: order.rxReservation.id },
          });
        }

        // A terminal retry must never reuse an abandoned provider checkout from
        // the previous attempt. Captured/succeeded payments were rejected above;
        // only still-pending intents are cancelled here and retained as audit
        // history on the order.
        await tx.carePortPaymentIntent.updateMany({
          where: {
            orderId: order.id,
            status: { in: ["CREATED", "REQUIRES_ACTION"] },
          },
          data: {
            status: "CANCELLED",
            providerStatus: "CANCELLED_TERMINAL_RETRY",
          },
        });

        await tx.carePortOrderItem.deleteMany({ where: { orderId: order.id } });

        order = await tx.carePortOrder.update({
          where: { id: order.id },
          data: {
            procurementSessionId: session.id,
            encounterId: session.encounterId,
            patientId: session.patientId,
            status: "RESERVED",
            fulfillment: "PICKUP",
            destinationAddr: null,
            destinationLat: null,
            destinationLng: null,
            chosenPharmacyId: quote.pharmacyId,
            chosenOfferId: null,
            subtotalCents: totals.gross,
            deliveryFeeCents: 0,
            totalCents: totals.gross,
            currency,
            sponsorAmountMinor: 0,
            patientCopayMinor: totals.gross,
            refundMinor: 0,
            settlementStatus: "UNSETTLED",
            settlementSnapshot: null,
          },
          include: { rxReservation: { include: { lines: true } } },
        });
      } else {
        order = await tx.carePortOrder.create({
          data: {
            orgId: args.orgId,
            erxOrderId: session.erxOrderId,
            refillNo: session.refillNo,
            procurementSessionId: session.id,
            encounterId: session.encounterId,
            patientId: session.patientId,
            status: "RESERVED",
            fulfillment: "PICKUP",
            chosenPharmacyId: quote.pharmacyId,
            subtotalCents: totals.gross,
            deliveryFeeCents: 0,
            totalCents: totals.gross,
            currency,
            sponsorAmountMinor: 0,
            patientCopayMinor: totals.gross,
            settlementStatus: "UNSETTLED",
          },
        });
      }

      // Acquire the NEW reservation only after any prior terminal reservation
      // was released. If any SKU changed concurrently, throwing here rolls back
      // the order reconciliation and every prior stock mutation in this tx.
      for (const row of lineSnapshots) {
        const changed = await tx.$executeRawUnsafe(
          `UPDATE "CarePortPharmacySku"
           SET "reservedStock" = "reservedStock" + $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2
             AND "pharmacyId" = $3
             AND "isActive" = true
             AND "stockOnHand" IS NOT NULL
             AND ("stockOnHand" - "reservedStock") >= $1`,
          row.quantity.packs,
          row.sku.id,
          quote.pharmacyId,
        );

        if (Number(changed) !== 1) {
          throw Object.assign(new Error("rx_stock_changed_before_reservation"), {
            status: 409,
            details: { skuId: row.sku.id, requiredPacks: row.quantity.packs },
          });
        }
      }

      await tx.carePortOrderItem.createMany({
        data: includedLines.map((line: any) => ({
          orderId: order.id,
          erxMedKey: line.erxMedKey,
          drugCode: line.drugCode,
          name: line.name,
          quantity: Math.max(1, Number(line.legacyQuantity || 1)),
          directions: line.directions,
        })),
        skipDuplicates: true,
      });

      const pricingSnapshot = {
        source: "CAREPORT_RX_WAVE_AB",
        quoteId: quote.id,
        reservationCreatedAt: now.toISOString(),
        quoteGeneratedAt: quote.generatedAt?.toISOString?.() ?? quote.generatedAt ?? null,
        priceAuthority: "LIVE_SKU_AT_RESERVATION",
        stockAuthority: "ATOMIC_LIVE_ALLOCATABLE_STOCK",
        taxAuthority: "SKU_RX_TAX_METADATA",
        fulfillmentActivation: "PICKUP_ONLY_UNTIL_WAVE_C",
        totals,
      };

      const existingReservation = await tx.carePortRxReservation.findUnique({
        where: { orderId: order.id },
      });

      const reservation = existingReservation
        ? await tx.carePortRxReservation.update({
            where: { id: existingReservation.id },
            data: {
              sessionId: session.id,
              quoteId: quote.id,
              pharmacyId: quote.pharmacyId,
              status: "HELD",
              fulfillment: "PICKUP",
              destinationAddr: null,
              destinationLat: null,
              destinationLng: null,
              subtotalNetCents: totals.net,
              taxCents: totals.tax,
              subtotalGrossCents: totals.gross,
              deliveryFeeCents: 0,
              totalCents: totals.gross,
              claimableSubtotalCents: totals.claimable,
              sponsorAmountMinor: 0,
              patientGapMinor: totals.gross,
              currency,
              expiresAt: reservationExpiresAt,
              securedAt: null,
              consumedAt: null,
              releasedAt: null,
              releaseReason: null,
              pricingSnapshot,
            },
          })
        : await tx.carePortRxReservation.create({
            data: {
              orgId: args.orgId,
              sessionId: session.id,
              orderId: order.id,
              quoteId: quote.id,
              pharmacyId: quote.pharmacyId,
              status: "HELD",
              fulfillment: "PICKUP",
              subtotalNetCents: totals.net,
              taxCents: totals.tax,
              subtotalGrossCents: totals.gross,
              deliveryFeeCents: 0,
              totalCents: totals.gross,
              claimableSubtotalCents: totals.claimable,
              sponsorAmountMinor: 0,
              patientGapMinor: totals.gross,
              currency,
              expiresAt: reservationExpiresAt,
              pricingSnapshot,
            },
          });

      await tx.carePortRxReservationLine.createMany({
        data: lineSnapshots.map((row) => ({
          reservationId: reservation.id,
          procurementLineId: row.line.id,
          quoteOptionId: row.option.id,
          skuId: row.sku.id,
          globalProductId: row.option.globalProductId ?? row.sku.globalProductId ?? null,
          globalProductKey: row.option.globalProductKey ?? row.sku.globalProductKey ?? null,
          prescribedQuantityValue: row.quantity.prescribedValue,
          prescribedQuantityUnit: row.quantity.prescribedUnit,
          requiredPacks: row.quantity.packs,
          unitsPerPack: row.quantity.unitsPerPack,
          dispenseUnit: row.quantity.dispenseUnit,
          unitListPriceCents: row.unitListPriceCents,
          priceBasis: "PACK",
          taxRateBps: row.taxRateBps,
          priceIncludesTax: Boolean(row.sku.rxPriceIncludesTax),
          netCents: row.netCents,
          taxCents: row.taxCents,
          grossCents: row.grossCents,
          medicalAidClaimable: Boolean(row.sku.medicalAidClaimable),
          productSnapshot: safeSnapshot({
            selectedOption: {
              id: row.option.id,
              matchAuthority: row.option.matchAuthority,
              requiresPharmacistReview: row.option.requiresPharmacistReview,
              displayName: row.option.displayName,
              canonicalName: row.option.canonicalName,
              brand: row.option.brand,
              manufacturer: row.option.manufacturer,
              ingredientText: row.option.ingredientText,
              strengthText: row.option.strengthText,
              dosageFormText: row.option.dosageFormText,
              packSize: row.option.packSize,
            },
            liveSku: {
              id: row.sku.id,
              name: row.sku.name,
              canonicalName: row.sku.canonicalName,
              brand: row.sku.brand,
              manufacturer: row.sku.manufacturer,
              packSize: row.sku.packSize,
              globalProductId: row.sku.globalProductId,
              globalProductKey: row.sku.globalProductKey,
            },
            quantityAuthority: row.quantity.quantityAuthority,
          }),
        })),
      });

      const updatedSession = await tx.carePortRxProcurementSession.update({
        where: { id: session.id },
        data: { status: "RESERVED" },
      });

      await emitCarePortRxPharmacyEventTx(tx, {
        orgId: args.orgId,
        orderId: order.id,
        pharmacyId: quote.pharmacyId,
        kind: existingReservation ? "RX_RESERVATION_REACQUIRED" : "RX_ORDER_RESERVED",
        patientId: session.patientId,
        encounterId: session.encounterId,
        clinicianId: await clinicianIdForErx(tx, session.erxOrderId),
        payload: {
          correlationId: args.correlationId,
          reservationId: reservation.id,
          expiresAt: reservationExpiresAt.toISOString(),
          lineCount: lineSnapshots.length,
          totalCents: totals.gross,
          currency,
        },
      });

      const fullReservation = await tx.carePortRxReservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: { lines: true },
      });

      return { order, session: updatedSession, reservation: fullReservation };
    },
    { isolationLevel: "Serializable", maxWait: 15_000, timeout: 30_000 } as any,
  );

  await auditEvent({
    kind: "careport_rx_reservation_created",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: result.order.id,
    meta: {
      orgId: args.orgId,
      correlationId: args.correlationId,
      sessionId: session.id,
      quoteId,
      reservationId: result.reservation.id,
      totalCents: result.reservation.totalCents,
      currency,
      fulfillment: "PICKUP",
    },
  });

  return {
    order: result.order,
    session: result.session,
    reservation: result.reservation,
  };
}

export async function expireHeldCarePortRxReservations(args: {
  orgId: string;
  limit?: number;
  actorId?: string | null;
  actorRole?: string | null;
}) {
  const now = new Date();
  const limit = Math.min(250, Math.max(1, Math.trunc(Number(args.limit || 100))));

  const candidates = await (prisma as any).carePortRxReservation.findMany({
    where: {
      orgId: args.orgId,
      status: "HELD",
      expiresAt: { lte: now },
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: Array<{ reservationId: string; orderId: string; released: boolean }> = [];

  for (const candidate of candidates) {
    const result = await (prisma as any).$transaction(
      async (tx: any) => {
        const current = await tx.carePortRxReservation.findUnique({
          where: { id: candidate.id },
          include: { lines: true },
        });

        if (
          !current ||
          String(current.status) !== "HELD" ||
          new Date(current.expiresAt).getTime() > Date.now()
        ) {
          return null;
        }

        const released = await releaseReservationStockTx(tx, current, "reservation_expired");

        await tx.carePortOrder.updateMany({
          where: {
            id: current.orderId,
            status: { in: ["RESERVED", "PAYMENT_PENDING"] },
          },
          data: { status: "EXPIRED" },
        });

        await tx.carePortRxProcurementSession.updateMany({
          where: {
            id: current.sessionId,
            status: { in: ["RESERVED", "PAYMENT_PENDING"] },
          },
          data: { status: "EXPIRED" },
        });

        await tx.carePortPaymentIntent.updateMany({
          where: {
            orderId: current.orderId,
            status: { in: ["CREATED", "REQUIRES_ACTION"] },
          },
          data: {
            status: "CANCELLED",
            providerStatus: "CANCELLED_RESERVATION_EXPIRED",
          },
        });

        await emitCarePortRxPharmacyEventTx(tx, {
          orgId: args.orgId,
          orderId: current.orderId,
          pharmacyId: current.pharmacyId,
          kind: "RX_RESERVATION_EXPIRED",
          payload: {
            reservationId: current.id,
            expiredAt: now.toISOString(),
            actorId: args.actorId ?? null,
            actorRole: args.actorRole ?? null,
          },
        });

        return {
          reservationId: released.id,
          orderId: current.orderId,
          released: true,
        };
      },
      { isolationLevel: "Serializable", maxWait: 15_000, timeout: 30_000 } as any,
    );

    if (result) results.push(result);
  }

  return {
    cutoff: now.toISOString(),
    scanned: candidates.length,
    expired: results.length,
    results,
  };
}

export async function getCarePortRxReservation(args: {
  who: Who;
  orgId: string;
  sessionId: string;
}) {
  const session = await getCarePortProcurementById({
    who: args.who,
    orgId: args.orgId,
    sessionId: args.sessionId,
  });

  const reservation = await (prisma as any).carePortRxReservation.findFirst({
    where: { sessionId: session.id, orgId: args.orgId },
    include: { lines: true, order: { include: { payments: { orderBy: { createdAt: "desc" } } } } },
    orderBy: { updatedAt: "desc" },
  });

  return { session, reservation };
}

function isCoveredDecision(value: unknown) {
  return ["COVERED", "COVERED_WITH_COPAY"].includes(clean(value, 80).toUpperCase());
}

async function sponsorAssessment(reservation: any, args: {
  orgId: string;
  patientId: string;
  clientId?: string | null;
  useSponsor: boolean;
}) {
  if (!args.useSponsor || Number(reservation.claimableSubtotalCents || 0) <= 0) {
    return {
      sponsorAmountMinor: 0,
      patientGapMinor: Number(reservation.totalCents || 0),
      coverage: null,
    };
  }

  const preflight = await runCoveragePreflight({
    orgId: args.orgId,
    patientId: args.patientId,
    serviceType: "PHARMACY_ITEM",
    visitMode: "HYBRID",
    requestedAmountMinor: Number(reservation.claimableSubtotalCents || 0),
    clientId: clean(args.clientId, 191) || undefined,
  });

  if (!isCoveredDecision(preflight?.decision)) {
    throw Object.assign(new Error("medical_aid_pharmacy_item_not_covered"), {
      status: 409,
      details: { preflight },
    });
  }

  const sponsorAmountMinor = Math.min(
    Number(reservation.totalCents || 0),
    Number(reservation.claimableSubtotalCents || 0),
    Math.max(0, Number(preflight?.sponsorAmountMinor || 0)),
  );

  return {
    sponsorAmountMinor,
    patientGapMinor: Math.max(0, Number(reservation.totalCents || 0) - sponsorAmountMinor),
    coverage: safeSnapshot(preflight),
  };
}

export async function beginCarePortRxPayment(args: {
  who: Who;
  orgId: string;
  correlationId: string;
  sessionId: string;
  body: any;
}) {
  const session = await getCarePortProcurementById({
    who: args.who,
    orgId: args.orgId,
    sessionId: args.sessionId,
  });

  const bundle = await (prisma as any).carePortRxReservation.findFirst({
    where: { sessionId: session.id, orgId: args.orgId },
    include: {
      lines: true,
      order: { include: { payments: { orderBy: { createdAt: "desc" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!bundle) {
    throw Object.assign(new Error("rx_reservation_not_found"), { status: 404 });
  }

  if (String(bundle.status) !== "HELD") {
    if (String(bundle.status) === "SECURED") {
      return {
        reservation: bundle,
        paymentIntent: bundle.order?.payments?.[0] ?? null,
        alreadySecured: true,
      };
    }
    throw Object.assign(new Error("rx_reservation_not_payable"), {
      status: 409,
      details: { status: bundle.status },
    });
  }

  if (new Date(bundle.expiresAt).getTime() <= Date.now()) {
    await (prisma as any).$transaction(async (tx: any) => {
      const current = await tx.carePortRxReservation.findUnique({
        where: { id: bundle.id },
        include: { lines: true },
      });
      if (current) await releaseReservationStockTx(tx, current, "reservation_expired");
      await tx.carePortOrder.update({ where: { id: bundle.orderId }, data: { status: "EXPIRED" } });
      await tx.carePortRxProcurementSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    });
    throw Object.assign(new Error("rx_reservation_expired"), { status: 409 });
  }

  const useSponsor = args.body?.useSponsor === true;
  const assessment = await sponsorAssessment(bundle, {
    orgId: args.orgId,
    patientId: session.patientId,
    clientId: args.body?.clientId,
    useSponsor,
  });

  const paymentMethod = clean(args.body?.paymentMethod ?? "CARD", 40).toUpperCase();
  if (!["CARD", "MEDICAL_AID"].includes(paymentMethod)) {
    throw Object.assign(new Error("canonical_rx_payment_method_invalid"), {
      status: 400,
      details: { supported: ["CARD", "MEDICAL_AID"] },
    });
  }

  if (paymentMethod === "MEDICAL_AID" && assessment.patientGapMinor > 0) {
    throw Object.assign(new Error("medical_aid_zero_gap_required_or_use_card_for_gap"), {
      status: 409,
      details: { patientGapMinor: assessment.patientGapMinor },
    });
  }

  const existingPending = (bundle.order?.payments || []).find(
    (payment: any) =>
      ["CREATED", "REQUIRES_ACTION"].includes(String(payment.status)) &&
      Number(payment.amountCents || 0) === assessment.patientGapMinor,
  );

  if (existingPending) {
    return {
      reservation: bundle,
      paymentIntent: existingPending,
      reusedPaymentIntent: true,
      coverage: assessment.coverage,
    };
  }

  if (assessment.patientGapMinor === 0) {
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const paymentIntent = await tx.carePortPaymentIntent.create({
        data: {
          orgId: args.orgId,
          orderId: bundle.orderId,
          method: "MEDICAL_AID",
          status: "AUTHORIZED",
          amountCents: 0,
          currency: bundle.currency,
          idempotencyKey: clean(args.body?.idempotencyKey, 191) || null,
          provider: "internal",
          providerRef: `medicalaid_${bundle.orderId}_${Date.now()}`,
          providerStatus: "AUTHORIZED_ZERO_GAP",
          metadata: {
            source: "CAREPORT_RX_WAVE_AB",
            coverage: assessment.coverage,
            sponsorAmountMinor: assessment.sponsorAmountMinor,
            patientGapMinor: 0,
          },
          authorizedAt: new Date(),
        },
      });

      const reservation = await tx.carePortRxReservation.update({
        where: { id: bundle.id },
        data: {
          status: "SECURED",
          sponsorAmountMinor: assessment.sponsorAmountMinor,
          patientGapMinor: 0,
          securedAt: new Date(),
          expiresAt: new Date(Date.now() + SECURED_RESERVATION_TTL_MS),
          pricingSnapshot: {
            ...asObject(bundle.pricingSnapshot),
            coverage: assessment.coverage,
            sponsorAmountMinor: assessment.sponsorAmountMinor,
            patientGapMinor: 0,
          },
        },
        include: { lines: true },
      });

      await resetPendingReviewTx(tx, args.orgId, bundle.orderId);

      const order = await tx.carePortOrder.update({
        where: { id: bundle.orderId },
        data: {
          status: "PHARMACIST_REVIEW",
          sponsorAmountMinor: assessment.sponsorAmountMinor,
          patientCopayMinor: 0,
        },
      });

      await tx.carePortRxProcurementSession.update({
        where: { id: session.id },
        data: { status: "PHARMACIST_REVIEW" },
      });

      await emitCarePortRxPharmacyEventTx(tx, {
        orgId: args.orgId,
        orderId: bundle.orderId,
        pharmacyId: bundle.pharmacyId,
        kind: "PHARMACIST_REVIEW_REQUIRED",
        patientId: session.patientId,
        encounterId: session.encounterId,
        clinicianId: await clinicianIdForErx(tx, session.erxOrderId),
        payload: {
          reservationId: bundle.id,
          paymentIntentId: paymentIntent.id,
          paymentTruth: "AUTHORIZED_ZERO_GAP_INTERNAL",
        },
      });

      return { paymentIntent, reservation, order };
    });

    return { ...result, coverage: assessment.coverage };
  }

  const configuredCardProvider = clean(
    process.env.CARD_PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER || "paystack",
    40,
  ).toLowerCase();

  if (configuredCardProvider === "payfast") {
    throw Object.assign(new Error("payfast_not_enabled_for_canonical_rx_until_async_reconciliation_is_governed"), {
      status: 409,
    });
  }

  const email = clean(args.body?.email, 320);
  if (!email) {
    throw Object.assign(new Error("patient_email_required_for_card_checkout"), { status: 400 });
  }

  const checkout = await beginCheckout({
    method: "CARD",
    appointmentId: bundle.orderId,
    amountCents: assessment.patientGapMinor,
    currency: bundle.currency,
    email,
    callbackUrl: clean(args.body?.callbackUrl, 1000) || null,
    metadata: {
      source: "CAREPORT_RX_WAVE_AB",
      orderId: bundle.orderId,
      sessionId: session.id,
      reservationId: bundle.id,
      sponsor: assessment.coverage,
    },
  });

  if (checkout.provider !== "paystack" && checkout.provider !== "mock") {
    throw Object.assign(new Error("canonical_rx_card_provider_not_supported"), {
      status: 409,
      details: { provider: checkout.provider },
    });
  }

  const paymentIntent = await (prisma as any).$transaction(async (tx: any) => {
    const intent = await tx.carePortPaymentIntent.create({
      data: {
        orgId: args.orgId,
        orderId: bundle.orderId,
        method: "CARD",
        status: "REQUIRES_ACTION",
        amountCents: assessment.patientGapMinor,
        currency: bundle.currency,
        idempotencyKey: clean(args.body?.idempotencyKey, 191) || checkout.reference,
        provider: checkout.provider,
        providerRef: checkout.reference,
        providerStatus: checkout.status,
        providerPayload: safeSnapshot(checkout.raw),
        metadata: {
          source: "CAREPORT_RX_WAVE_AB",
          reservationId: bundle.id,
          sessionId: session.id,
          sponsorAmountMinor: assessment.sponsorAmountMinor,
          patientGapMinor: assessment.patientGapMinor,
          coverage: assessment.coverage,
        },
      },
    });

    await tx.carePortRxReservation.update({
      where: { id: bundle.id },
      data: {
        sponsorAmountMinor: assessment.sponsorAmountMinor,
        patientGapMinor: assessment.patientGapMinor,
        pricingSnapshot: {
          ...asObject(bundle.pricingSnapshot),
          coverage: assessment.coverage,
          sponsorAmountMinor: assessment.sponsorAmountMinor,
          patientGapMinor: assessment.patientGapMinor,
        },
      },
    });

    await tx.carePortOrder.update({
      where: { id: bundle.orderId },
      data: {
        status: "PAYMENT_PENDING",
        sponsorAmountMinor: assessment.sponsorAmountMinor,
        patientCopayMinor: assessment.patientGapMinor,
      },
    });

    await tx.carePortRxProcurementSession.update({
      where: { id: session.id },
      data: { status: "PAYMENT_PENDING" },
    });

    return intent;
  });

  return {
    paymentIntent,
    reservation: {
      ...bundle,
      sponsorAmountMinor: assessment.sponsorAmountMinor,
      patientGapMinor: assessment.patientGapMinor,
    },
    checkout: {
      provider: checkout.provider,
      reference: checkout.reference,
      status: checkout.status,
      redirectUrl: checkout.redirectUrl,
    },
    coverage: assessment.coverage,
  };
}

export async function verifyCarePortRxPayment(args: {
  who: Who;
  orgId: string;
  correlationId: string;
  sessionId: string;
  body: any;
}) {
  const session = await getCarePortProcurementById({
    who: args.who,
    orgId: args.orgId,
    sessionId: args.sessionId,
  });

  const paymentIntentId = clean(args.body?.paymentIntentId, 191);
  const reference = clean(args.body?.reference ?? args.body?.paymentReference, 191);

  if (!paymentIntentId && !reference) {
    throw Object.assign(new Error("payment_intent_or_reference_required"), { status: 400 });
  }

  const payment = await (prisma as any).carePortPaymentIntent.findFirst({
    where: {
      orgId: args.orgId,
      order: { procurementSessionId: session.id },
      ...(paymentIntentId ? { id: paymentIntentId } : { providerRef: reference }),
    },
    include: { order: { include: { rxReservation: { include: { lines: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  if (!payment || !payment.order?.rxReservation) {
    throw Object.assign(new Error("canonical_rx_payment_not_found"), { status: 404 });
  }

  if (String(payment.status) === "CAPTURED") {
    return {
      paymentIntent: payment,
      reservation: payment.order.rxReservation,
      alreadyCaptured: true,
    };
  }

  const providerName = clean(payment.provider, 40).toLowerCase();
  if (!["paystack", "mock"].includes(providerName)) {
    throw Object.assign(new Error("canonical_rx_payment_provider_not_verifiable"), {
      status: 409,
      details: { provider: providerName || null },
    });
  }

  const verified = await verifyCheckout({
    provider: providerName as "paystack" | "mock",
    reference: clean(payment.providerRef, 191),
    expectedAmountCents: Number(payment.amountCents || 0),
    expectedCurrency: payment.currency || "ZAR",
  });

  if (verified.status === "pending") {
    await (prisma as any).carePortPaymentIntent.update({
      where: { id: payment.id },
      data: { providerStatus: "PENDING", providerPayload: safeSnapshot(verified.raw) },
    });
    return { paymentIntent: payment, verification: verified, pending: true };
  }

  if (verified.status !== "captured") {
    const failed = await (prisma as any).carePortPaymentIntent.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        providerStatus: "FAILED",
        providerPayload: safeSnapshot(verified.raw),
        failedAt: new Date(),
        failureReason: "provider_verification_failed",
      },
    });
    return { paymentIntent: failed, verification: verified, captured: false };
  }

  const result = await (prisma as any).$transaction(async (tx: any) => {
    const intent = await tx.carePortPaymentIntent.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        providerStatus: "CAPTURED",
        providerPayload: safeSnapshot(verified.raw),
        capturedAt: new Date(),
        paidAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    const reservation = await tx.carePortRxReservation.update({
      where: { id: payment.order.rxReservation.id },
      data: {
        status: "SECURED",
        securedAt: new Date(),
        expiresAt: new Date(Date.now() + SECURED_RESERVATION_TTL_MS),
      },
      include: { lines: true },
    });

    await resetPendingReviewTx(tx, args.orgId, payment.orderId);

    const order = await tx.carePortOrder.update({
      where: { id: payment.orderId },
      data: { status: "PHARMACIST_REVIEW" },
    });

    await tx.carePortRxProcurementSession.update({
      where: { id: session.id },
      data: { status: "PHARMACIST_REVIEW" },
    });

    await emitCarePortRxPharmacyEventTx(tx, {
      orgId: args.orgId,
      orderId: payment.orderId,
      pharmacyId: reservation.pharmacyId,
      kind: "PHARMACIST_REVIEW_REQUIRED",
      patientId: session.patientId,
      encounterId: session.encounterId,
      clinicianId: await clinicianIdForErx(tx, session.erxOrderId),
      payload: {
        reservationId: reservation.id,
        paymentIntentId: intent.id,
        paymentTruth: "CAPTURED_BY_PROVIDER",
      },
    });

    return { paymentIntent: intent, reservation, order };
  });

  await auditEvent({
    kind: "careport_rx_payment_captured",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: payment.orderId,
    meta: {
      orgId: args.orgId,
      correlationId: args.correlationId,
      paymentIntentId: result.paymentIntent.id,
      provider: providerName,
      amountCents: result.paymentIntent.amountCents,
      currency: result.paymentIntent.currency,
    },
  });

  return { ...result, verification: verified, captured: true };
}

export async function refundAndReleaseCanonicalOrder(args: {
  orgId: string;
  orderId: string;
  reason: string;
  actorId?: string | null;
  actorRole?: string | null;
}) {
  const refund = await refundCapturedPaymentIfNeeded({
    orgId: args.orgId,
    orderId: args.orderId,
    reason: args.reason,
  });

  return (prisma as any).$transaction(async (tx: any) => {
    const order = await reservationBundleForOrder(tx, args.orgId, args.orderId);
    if (!order || !order.rxReservation) {
      throw Object.assign(new Error("canonical_rx_order_or_reservation_not_found"), { status: 404 });
    }

    const reservation = await releaseReservationStockTx(tx, order.rxReservation, args.reason);

    await tx.carePortOrder.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        refundMinor: refund?.refunded ? Number(order.patientCopayMinor || 0) : Number(order.refundMinor || 0),
      },
    });

    await tx.carePortRxProcurementSession.update({
      where: { id: reservation.sessionId },
      data: { status: "CANCELLED" },
    });

    await emitCarePortRxPharmacyEventTx(tx, {
      orgId: args.orgId,
      orderId: order.id,
      pharmacyId: reservation.pharmacyId,
      kind: "RX_ORDER_CANCELLED",
      payload: {
        reason: args.reason,
        refund,
        actorId: args.actorId ?? null,
        actorRole: args.actorRole ?? null,
      },
    });

    return { orderId: order.id, reservation, refund };
  });
}

export async function cancelCarePortRxReservation(args: {
  who: Who;
  orgId: string;
  correlationId: string;
  sessionId: string;
  body: any;
}) {
  const session = await getCarePortProcurementById({
    who: args.who,
    orgId: args.orgId,
    sessionId: args.sessionId,
  });

  const reservation = await (prisma as any).carePortRxReservation.findFirst({
    where: { sessionId: session.id, orgId: args.orgId },
    orderBy: { updatedAt: "desc" },
  });

  if (!reservation) {
    throw Object.assign(new Error("rx_reservation_not_found"), { status: 404 });
  }

  const order = await (prisma as any).carePortOrder.findFirst({
    where: { id: reservation.orderId, orgId: args.orgId },
    select: { id: true, status: true, procurementSessionId: true },
  });

  if (!order?.procurementSessionId) {
    throw Object.assign(new Error("canonical_rx_order_required"), { status: 409 });
  }

  if (!["RESERVED", "PAYMENT_PENDING", "PAYMENT_AUTHORIZED", "PAYMENT_CAPTURED", "PHARMACIST_REVIEW"].includes(String(order.status))) {
    throw Object.assign(new Error("patient_cancellation_not_allowed_after_pharmacist_release"), {
      status: 409,
      details: { orderId: order.id, status: order.status },
    });
  }

  if (String(reservation.status) === "CONSUMED") {
    throw Object.assign(new Error("patient_cancellation_not_allowed_after_stock_consumption"), { status: 409 });
  }

  const result = await refundAndReleaseCanonicalOrder({
    orgId: args.orgId,
    orderId: reservation.orderId,
    reason: clean(args.body?.reason, 120) || "patient_cancelled",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
  });

  await auditEvent({
    kind: "careport_rx_order_cancelled",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: reservation.orderId,
    meta: { orgId: args.orgId, correlationId: args.correlationId, reason: args.body?.reason ?? null },
  });

  return result;
}
