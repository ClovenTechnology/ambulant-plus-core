import { prisma } from "@/src/lib/db";
import {
  auditEvent,
  pharmacyIdForStaff,
} from "@/src/lib/careport";
import { readIdentity } from "@/src/lib/identity";
import {
  consumeReservationStockTx,
  emitCarePortRxPharmacyEventTx,
  refundAndReleaseCanonicalOrder,
} from "@/src/lib/careport-rx-commerce";

type Who = ReturnType<typeof readIdentity>;

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function safeSnapshot(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

export async function resolveCarePortPharmacyId(args: {
  who: Who;
  orgId: string;
  explicitPharmacyId?: string | null;
}) {
  const explicit = clean(args.explicitPharmacyId, 191);

  if (String(args.who.role) === "admin" && explicit) return explicit;
  if (String(args.who.role) === "pharmacy" && args.who.uid) return String(args.who.uid);

  if (String(args.who.role) === "pharmacy_staff" && args.who.uid) {
    const mapped = await pharmacyIdForStaff(args.orgId, String(args.who.uid));
    return mapped ? String(mapped) : null;
  }

  return null;
}

function validateTimezone(value: unknown): string | null {
  const zone = clean(value, 80);
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en-ZA", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    throw Object.assign(new Error("rx_timezone_invalid"), {
      status: 400,
      details: { rxTimeZone: zone },
    });
  }
}

function minute(value: unknown): string {
  const raw = clean(value, 5);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) {
    throw Object.assign(new Error("rx_opening_hours_time_invalid"), {
      status: 400,
      details: { value: raw || null },
    });
  }
  return raw;
}

function normalizeOpeningHours(value: unknown): any | null {
  if (value == null || value === "") return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("rx_opening_hours_object_required"), { status: 400 });
  }

  const allowedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const output: Record<string, Array<{ open: string; close: string }>> = {};

  for (const day of allowedDays) {
    const raw = (value as any)[day];
    if (raw == null) continue;

    const windows = Array.isArray(raw) ? raw : [raw];
    if (windows.length > 4) {
      throw Object.assign(new Error("too_many_rx_opening_windows"), {
        status: 400,
        details: { day },
      });
    }

    output[day] = windows.map((window: any) => ({
      open: minute(window?.open ?? window?.start),
      close: minute(window?.close ?? window?.end),
    }));
  }

  return output;
}

export async function getCarePortRxAvailability(args: {
  orgId: string;
  pharmacyId: string;
}) {
  const pharmacy = await (prisma as any).pharmacyPartner.findFirst({
    where: { id: args.pharmacyId, orgId: args.orgId },
    select: {
      id: true,
      name: true,
      active: true,
      supportsPickup: true,
      supportsDelivery: true,
      acceptingRxOrders: true,
      rxOpeningHours: true,
      rxTimeZone: true,
      rxOrderPauseReason: true,
      rxOrderPauseUntil: true,
      kycStatus: true,
      kycVerifiedAt: true,
    },
  });

  if (!pharmacy) {
    throw Object.assign(new Error("pharmacy_not_found"), { status: 404 });
  }

  return pharmacy;
}

export async function updateCarePortRxAvailability(args: {
  who: Who;
  orgId: string;
  pharmacyId: string;
  body: any;
}) {
  const current = await getCarePortRxAvailability({
    orgId: args.orgId,
    pharmacyId: args.pharmacyId,
  });

  const data: Record<string, any> = {};

  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "acceptingRxOrders")) {
    data.acceptingRxOrders = args.body?.acceptingRxOrders === true;
  }

  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "rxOpeningHours")) {
    data.rxOpeningHours = normalizeOpeningHours(args.body?.rxOpeningHours);
  }

  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "rxTimeZone")) {
    data.rxTimeZone = validateTimezone(args.body?.rxTimeZone);
  }

  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "rxOrderPauseReason")) {
    data.rxOrderPauseReason = clean(args.body?.rxOrderPauseReason, 240) || null;
  }

  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "rxOrderPauseUntil")) {
    const raw = clean(args.body?.rxOrderPauseUntil, 80);
    if (!raw) {
      data.rxOrderPauseUntil = null;
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        throw Object.assign(new Error("rx_pause_until_invalid"), { status: 400 });
      }
      if (parsed.getTime() <= Date.now()) {
        throw Object.assign(new Error("rx_pause_until_must_be_future_or_null"), { status: 400 });
      }
      data.rxOrderPauseUntil = parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "supportsPickup")) {
    data.supportsPickup = args.body?.supportsPickup === true;
  }

  // Delivery remains a pharmacy capability setting, but canonical Rx Patient
  // checkout does not activate delivery until Wave C.
  if (Object.prototype.hasOwnProperty.call(args.body ?? {}, "supportsDelivery")) {
    data.supportsDelivery = args.body?.supportsDelivery === true;
  }

  if (!Object.keys(data).length) {
    throw Object.assign(new Error("no_rx_availability_update_fields"), { status: 400 });
  }

  const updated = await (prisma as any).pharmacyPartner.update({
    where: { id: args.pharmacyId },
    data,
  });

  await auditEvent({
    kind: "careport_rx_pharmacy_availability_updated",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: args.pharmacyId,
    meta: {
      orgId: args.orgId,
      changed: Object.keys(data),
      previous: current,
    },
  });

  return updated;
}

async function canonicalOrderForPharmacy(args: {
  orgId: string;
  orderId: string;
  pharmacyId: string;
}) {
  const order = await (prisma as any).carePortOrder.findFirst({
    where: {
      id: args.orderId,
      orgId: args.orgId,
      chosenPharmacyId: args.pharmacyId,
      procurementSessionId: { not: null },
    },
    include: {
      chosenPharmacy: true,
      procurementSession: { include: { lines: true } },
      rxReservation: { include: { lines: true } },
      rxPharmacistReview: true,
      rxPharmacyFulfilment: true,
      rxDispenseLines: true,
      payments: { orderBy: { createdAt: "desc" } },
      items: true,
    },
  });

  if (!order) {
    throw Object.assign(new Error("canonical_rx_order_not_found"), { status: 404 });
  }

  return order;
}

export async function getCarePortRxClinicalOrder(args: {
  orgId: string;
  orderId: string;
  pharmacyId: string;
}) {
  return canonicalOrderForPharmacy(args);
}

function paymentSecured(order: any) {
  return (order.payments || []).some((payment: any) =>
    ["AUTHORIZED", "CAPTURED", "SUCCEEDED"].includes(String(payment.status)),
  );
}

async function createDispenseTruthTx(tx: any, args: {
  orgId: string;
  order: any;
  pharmacistId: string | null;
}) {
  const reservation = args.order.rxReservation;
  if (!reservation || String(reservation.status) !== "SECURED") {
    throw Object.assign(new Error("secured_rx_reservation_required"), { status: 409 });
  }

  for (const line of reservation.lines || []) {
    const snapshot = asObject(line.productSnapshot);
    const selected = asObject(snapshot.selectedOption);
    const liveSku = asObject(snapshot.liveSku);

    await tx.carePortRxDispenseLine.upsert({
      where: { reservationLineId: line.id },
      update: {
        pharmacistId: args.pharmacistId,
        labelVersion: { increment: 1 },
        dispenseSnapshot: {
          source: "CAREPORT_RX_WAVE_AB",
          selectedOption: selected,
          quantityAuthority: snapshot.quantityAuthority ?? null,
          releasedAt: new Date().toISOString(),
        },
      },
      create: {
        orgId: args.orgId,
        orderId: args.order.id,
        reservationLineId: line.id,
        procurementLineId: line.procurementLineId,
        skuId: line.skuId,
        globalProductId: line.globalProductId,
        displayName: clean(selected.displayName || liveSku.name || "Medication", 500),
        canonicalName: clean(selected.canonicalName || liveSku.canonicalName, 500) || null,
        brand: clean(selected.brand || liveSku.brand, 160) || null,
        manufacturer: clean(selected.manufacturer || liveSku.manufacturer, 160) || null,
        ingredientText: clean(selected.ingredientText, 1000) || null,
        strengthText: clean(selected.strengthText, 160) || null,
        dosageFormText: clean(selected.dosageFormText, 160) || null,
        packSize: clean(selected.packSize || liveSku.packSize, 120) || null,
        quantityDispensedPacks: Math.max(1, Number(line.requiredPacks || 1)),
        substitution: false,
        substitutionReason: null,
        pharmacistId: args.pharmacistId,
        unitPriceCents: Number(line.unitListPriceCents || 0),
        currency: reservation.currency || "ZAR",
        labelVersion: 1,
        dispenseSnapshot: {
          source: "CAREPORT_RX_WAVE_AB",
          selectedOption: selected,
          quantityAuthority: snapshot.quantityAuthority ?? null,
          releasedAt: new Date().toISOString(),
        },
      },
    });
  }
}

export async function reviewCarePortRxOrder(args: {
  who: Who;
  orgId: string;
  pharmacyId: string;
  orderId: string;
  body: any;
}) {
  const action = clean(args.body?.action, 80).toUpperCase();
  const reasonCode = clean(args.body?.reasonCode, 120) || null;
  const note = clean(args.body?.note, 2000) || null;
  const pharmacistId = clean(args.who.uid, 191) || null;

  if (!["RELEASE", "CLARIFICATION_REQUIRED", "REJECT"].includes(action)) {
    throw Object.assign(new Error("pharmacist_review_action_invalid"), { status: 400 });
  }

  const order = await canonicalOrderForPharmacy({
    orgId: args.orgId,
    orderId: args.orderId,
    pharmacyId: args.pharmacyId,
  });

  if (!order.rxReservation) {
    throw Object.assign(new Error("canonical_rx_reservation_missing"), { status: 409 });
  }

  if (!paymentSecured(order)) {
    throw Object.assign(new Error("payment_not_secured_for_pharmacist_review"), { status: 409 });
  }

  if (!["SECURED", "CONSUMED"].includes(String(order.rxReservation.status))) {
    throw Object.assign(new Error("reservation_not_secured_for_pharmacist_review"), {
      status: 409,
      details: { reservationStatus: order.rxReservation.status },
    });
  }

  if (String(order.rxPharmacistReview?.status) === "RELEASED") {
    if (action === "RELEASE") {
      // Idempotent pharmacist release: never regenerate dispense truth or bump
      // label versions merely because a user/browser retries the same action.
      return { review: order.rxPharmacistReview, order, idempotent: true };
    }

    // Once release has created actual-dispense truth, the clinical decision is
    // final in Wave AB. Rejection/clarification after release would require a
    // governed reversal/return workflow rather than silently rewriting the
    // pharmacist audit trail.
    throw Object.assign(new Error("pharmacist_release_is_final"), {
      status: 409,
      details: { orderId: order.id, requestedAction: action },
    });
  }

  if (action === "REJECT" && (
    String(order.rxReservation.status) === "CONSUMED" ||
    ["PACKING_COMPLETE", "READY_FOR_PICKUP", "COMPLETED"].includes(String(order.status))
  )) {
    throw Object.assign(new Error("pharmacist_rejection_not_allowed_after_stock_consumption"), {
      status: 409,
      details: { orderId: order.id, orderStatus: order.status, reservationStatus: order.rxReservation.status },
    });
  }

  if (action === "REJECT") {
    const released = await refundAndReleaseCanonicalOrder({
      orgId: args.orgId,
      orderId: order.id,
      reason: reasonCode || "pharmacist_rejected",
      actorId: args.who.uid ?? null,
      actorRole: args.who.role ?? null,
    });

    const review = await (prisma as any).carePortRxPharmacistReview.upsert({
      where: { orderId: order.id },
      update: {
        status: "REJECTED",
        reasonCode: reasonCode || "PHARMACIST_REJECTED",
        note,
        decidedBy: pharmacistId,
        decidedAt: new Date(),
      },
      create: {
        orgId: args.orgId,
        orderId: order.id,
        status: "REJECTED",
        reasonCode: reasonCode || "PHARMACIST_REJECTED",
        note,
        decidedBy: pharmacistId,
        decidedAt: new Date(),
      },
    });

    return { orderId: order.id, review, cancellation: released };
  }

  const result = await (prisma as any).$transaction(async (tx: any) => {
    if (action === "CLARIFICATION_REQUIRED") {
      const review = await tx.carePortRxPharmacistReview.upsert({
        where: { orderId: order.id },
        update: {
          status: "CLARIFICATION_REQUIRED",
          reasonCode: reasonCode || "CLARIFICATION_REQUIRED",
          note,
          decidedBy: pharmacistId,
          decidedAt: new Date(),
        },
        create: {
          orgId: args.orgId,
          orderId: order.id,
          status: "CLARIFICATION_REQUIRED",
          reasonCode: reasonCode || "CLARIFICATION_REQUIRED",
          note,
          decidedBy: pharmacistId,
          decidedAt: new Date(),
        },
      });

      await emitCarePortRxPharmacyEventTx(tx, {
        orgId: args.orgId,
        orderId: order.id,
        pharmacyId: args.pharmacyId,
        kind: "CLARIFICATION_REQUIRED",
        patientId: order.patientId,
        encounterId: order.encounterId,
        payload: { reasonCode: review.reasonCode, note },
      });

      return { review, order };
    }

    // Wave AB does not allow post-reservation arbitrary substitution. Generic
    // choices must already be represented by the selected quote option.
    const requestedDispense = Array.isArray(args.body?.dispense) ? args.body.dispense : [];
    for (const row of requestedDispense) {
      const reservationLineId = clean(row?.reservationLineId, 191);
      const requestedSkuId = clean(row?.actualSkuId ?? row?.skuId, 191);
      const reserved = (order.rxReservation.lines || []).find(
        (line: any) => String(line.id) === reservationLineId,
      );
      if (!reserved || !requestedSkuId || requestedSkuId !== String(reserved.skuId)) {
        throw Object.assign(new Error("post_reservation_substitution_requires_reprice_and_new_authorization"), {
          status: 409,
          details: { reservationLineId, requestedSkuId },
        });
      }
    }

    const review = await tx.carePortRxPharmacistReview.upsert({
      where: { orderId: order.id },
      update: {
        status: "RELEASED",
        reasonCode,
        note,
        decidedBy: pharmacistId,
        decidedAt: new Date(),
      },
      create: {
        orgId: args.orgId,
        orderId: order.id,
        status: "RELEASED",
        reasonCode,
        note,
        decidedBy: pharmacistId,
        decidedAt: new Date(),
      },
    });

    await createDispenseTruthTx(tx, {
      orgId: args.orgId,
      order,
      pharmacistId,
    });

    const updatedOrder = await tx.carePortOrder.update({
      where: { id: order.id },
      data: { status: "PHARMACIST_RELEASED" },
    });

    await tx.carePortRxProcurementSession.update({
      where: { id: order.procurementSessionId },
      data: { status: "FULFILMENT_ACTIVE" },
    });

    await emitCarePortRxPharmacyEventTx(tx, {
      orgId: args.orgId,
      orderId: order.id,
      pharmacyId: args.pharmacyId,
      kind: "PHARMACIST_RELEASED",
      patientId: order.patientId,
      encounterId: order.encounterId,
      payload: {
        reviewId: review.id,
        pharmacistId,
        dispenseLineCount: (order.rxReservation.lines || []).length,
      },
    });

    return { review, order: updatedOrder };
  });

  await auditEvent({
    kind: "careport_rx_pharmacist_review_decided",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: order.id,
    meta: { orgId: args.orgId, pharmacyId: args.pharmacyId, action, reasonCode },
  });

  return result;
}

export async function updateCarePortRxFulfilment(args: {
  who: Who;
  orgId: string;
  pharmacyId: string;
  orderId: string;
  body: any;
}) {
  const action = clean(args.body?.action, 80).toUpperCase();
  if (!["START_PREPARING", "SET_ETA", "PACKING_COMPLETE", "READY_FOR_PICKUP", "MARK_COLLECTED"].includes(action)) {
    throw Object.assign(new Error("rx_fulfilment_action_invalid"), { status: 400 });
  }

  const order = await canonicalOrderForPharmacy({
    orgId: args.orgId,
    orderId: args.orderId,
    pharmacyId: args.pharmacyId,
  });

  if (String(order.fulfillment) !== "PICKUP") {
    throw Object.assign(new Error("canonical_rx_delivery_requires_wave_c"), { status: 409 });
  }

  if (String(order.rxPharmacistReview?.status) !== "RELEASED") {
    throw Object.assign(new Error("pharmacist_release_required_before_preparation"), { status: 409 });
  }

  if (!order.rxReservation || !["SECURED", "CONSUMED"].includes(String(order.rxReservation.status))) {
    throw Object.assign(new Error("secured_reservation_required_before_preparation"), { status: 409 });
  }

  const result = await (prisma as any).$transaction(async (tx: any) => {
    const now = new Date();
    let orderStatus = String(order.status);
    let eventKind = "";
    let fulfilmentData: Record<string, any> = {};

    if (action === "START_PREPARING") {
      if (!["PHARMACIST_RELEASED", "PREPARING"].includes(orderStatus)) {
        throw Object.assign(new Error("invalid_rx_start_preparing_state"), { status: 409 });
      }
      orderStatus = "PREPARING";
      eventKind = "PREPARATION_STARTED";
      fulfilmentData.preparationStartedAt = order.rxPharmacyFulfilment?.preparationStartedAt || now;
    }

    if (action === "SET_ETA") {
      const eta = Number(args.body?.preparationEtaMin);
      if (!Number.isFinite(eta) || eta < 1 || eta > 24 * 60) {
        throw Object.assign(new Error("preparation_eta_invalid"), { status: 400 });
      }
      orderStatus = ["PHARMACIST_RELEASED", "PREPARING"].includes(orderStatus) ? "PREPARING" : orderStatus;
      eventKind = "PREPARATION_ETA_UPDATED";
      fulfilmentData.preparationEtaMin = Math.trunc(eta);
      fulfilmentData.expectedReadyAt = new Date(now.getTime() + Math.trunc(eta) * 60_000);
      fulfilmentData.preparationStartedAt = order.rxPharmacyFulfilment?.preparationStartedAt || now;
    }

    if (action === "PACKING_COMPLETE") {
      if (!["PHARMACIST_RELEASED", "PREPARING"].includes(orderStatus)) {
        throw Object.assign(new Error("invalid_rx_packing_complete_state"), { status: 409 });
      }

      const expected = (order.rxReservation.lines || []).length;
      const actual = (order.rxDispenseLines || []).length;
      if (!expected || actual !== expected) {
        throw Object.assign(new Error("actual_dispense_truth_incomplete"), {
          status: 409,
          details: { reservationLineCount: expected, dispenseLineCount: actual },
        });
      }

      if (String(order.rxReservation.status) !== "CONSUMED") {
        await consumeReservationStockTx(tx, order.rxReservation);
      }

      orderStatus = "PACKING_COMPLETE";
      eventKind = "PACKING_COMPLETE";
      fulfilmentData.packingCompleteAt = now;
    }

    if (action === "READY_FOR_PICKUP") {
      if (!["PACKING_COMPLETE", "READY_FOR_PICKUP"].includes(orderStatus)) {
        throw Object.assign(new Error("packing_complete_required_before_pickup_ready"), { status: 409 });
      }
      orderStatus = "READY_FOR_PICKUP";
      eventKind = "READY_FOR_PICKUP";
      fulfilmentData.readyAt = order.rxPharmacyFulfilment?.readyAt || now;
    }

    if (action === "MARK_COLLECTED") {
      if (orderStatus !== "READY_FOR_PICKUP") {
        throw Object.assign(new Error("ready_for_pickup_required_before_collection"), { status: 409 });
      }
      orderStatus = "COMPLETED";
      eventKind = "RX_PICKUP_COMPLETED";
      fulfilmentData.collectedAt = now;
    }

    const fulfilment = await tx.carePortRxPharmacyFulfilment.upsert({
      where: { orderId: order.id },
      update: fulfilmentData,
      create: {
        orgId: args.orgId,
        orderId: order.id,
        ...fulfilmentData,
      },
    });

    const updatedOrder = await tx.carePortOrder.update({
      where: { id: order.id },
      data: { status: orderStatus },
    });

    if (action === "MARK_COLLECTED") {
      await tx.carePortRxProcurementSession.update({
        where: { id: order.procurementSessionId },
        data: { status: "COMPLETED" },
      });
    }

    await emitCarePortRxPharmacyEventTx(tx, {
      orgId: args.orgId,
      orderId: order.id,
      pharmacyId: args.pharmacyId,
      kind: eventKind,
      patientId: order.patientId,
      encounterId: order.encounterId,
      payload: {
        action,
        status: orderStatus,
        preparationEtaMin: fulfilment.preparationEtaMin ?? null,
        expectedReadyAt: fulfilment.expectedReadyAt?.toISOString?.() ?? null,
      },
    });

    return { order: updatedOrder, fulfilment };
  });

  await auditEvent({
    kind: "careport_rx_fulfilment_updated",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: order.id,
    meta: { orgId: args.orgId, pharmacyId: args.pharmacyId, action },
  });

  return result;
}

function patientInitials(name: string | null | undefined) {
  const tokens = clean(name, 160).split(/\s+/).filter(Boolean);
  return tokens.slice(0, 2).map((token) => token[0]?.toUpperCase() || "").join("") || "PT";
}

export async function getCarePortRxLabels(args: {
  who: Who;
  orgId: string;
  pharmacyId: string;
  orderId: string;
  incrementVersions?: boolean;
}) {
  const order = await canonicalOrderForPharmacy({
    orgId: args.orgId,
    orderId: args.orderId,
    pharmacyId: args.pharmacyId,
  });

  if (String(order.rxPharmacistReview?.status) !== "RELEASED") {
    throw Object.assign(new Error("pharmacist_release_required_before_labels"), { status: 409 });
  }

  if (!(order.rxDispenseLines || []).length) {
    throw Object.assign(new Error("dispense_truth_required_before_labels"), { status: 409 });
  }

  let fulfilment = order.rxPharmacyFulfilment;
  if (!fulfilment) {
    fulfilment = await (prisma as any).carePortRxPharmacyFulfilment.create({
      data: { orgId: args.orgId, orderId: order.id },
    });
  }

  if (args.incrementVersions) {
    fulfilment = await (prisma as any).carePortRxPharmacyFulfilment.update({
      where: { orderId: order.id },
      data: {
        dispensingLabelVersion: { increment: 1 },
        outerLabelVersion: { increment: 1 },
      },
    });

    await auditEvent({
      kind: "careport_rx_labels_reprinted",
      actorId: args.who.uid ?? null,
      actorRole: args.who.role ?? null,
      subjectId: order.id,
      meta: {
        orgId: args.orgId,
        pharmacyId: args.pharmacyId,
        dispensingLabelVersion: fulfilment.dispensingLabelVersion,
        outerLabelVersion: fulfilment.outerLabelVersion,
      },
    });
  }

  const dispensingLabelVersion = Math.max(1, Number(fulfilment.dispensingLabelVersion || 1));
  const outerLabelVersion = Math.max(1, Number(fulfilment.outerLabelVersion || 1));

  const dispensingLabels = (order.rxDispenseLines || []).map((line: any) => ({
    version: dispensingLabelVersion,
    orderId: order.id,
    product: {
      displayName: line.displayName,
      canonicalName: line.canonicalName ?? null,
      brand: line.brand ?? null,
      ingredientText: line.ingredientText ?? null,
      strengthText: line.strengthText ?? null,
      dosageFormText: line.dosageFormText ?? null,
      packSize: line.packSize ?? null,
    },
    quantityDispensedPacks: line.quantityDispensedPacks,
    directions:
      (order.procurementSession?.lines || []).find(
        (rxLine: any) => String(rxLine.id) === String(line.procurementLineId),
      )?.directions ?? null,
    pharmacistId: line.pharmacistId ?? null,
    pharmacyName: order.chosenPharmacy?.name ?? null,
    generatedAt: new Date().toISOString(),
  }));

  // The outer label is deliberately medication-blind.
  const outerLabel = {
    version: outerLabelVersion,
    orderReference: order.id,
    recipient: {
      initials: patientInitials(null),
      patientReference: String(order.patientId || "").slice(-8),
    },
    pharmacy: {
      id: args.pharmacyId,
      name: order.chosenPharmacy?.name ?? null,
    },
    fulfillment: "PICKUP",
    waveCDeliveryActivationRequired: true,
    medicineNamesIncluded: false,
    diagnosisIncluded: false,
    generatedAt: new Date().toISOString(),
  };

  return { orderId: order.id, dispensingLabels, outerLabel };
}
