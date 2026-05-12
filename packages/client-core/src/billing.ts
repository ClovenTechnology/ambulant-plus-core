import type { Prisma } from '@prisma/client';
import { PrismaTx, dbOrTx } from "./lib/prisma";
import {
  findIdempotentResponse,
  saveIdempotentResponse,
  softJsonHash,
} from "./lib/idempotency";

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export type CreateBillableEventInput = {
  orgId?: string;
  clientId?: string;
  clientMemberId?: string;
  authorizationId?: string;
  encounterId?: string;
  appointmentId?: string;
  labOrderId?: string;
  erxOrderId?: string;
  carePortOrderId?: string;
  deliveryId?: string;
  drawId?: string;
  deviceId?: string;
  patientId?: string;
  userId?: string;
  serviceType:
    | "CONSULT_STANDARD"
    | "CONSULT_FOLLOWUP"
    | "CONSULT_PROCEDURE"
    | "PHYSICAL_VISIT"
    | "LAB_TEST"
    | "PHLEB_DRAW"
    | "LAB_LOGISTICS"
    | "PHARMACY_ITEM"
    | "PHARMACY_DISPENSING"
    | "RIDER_DELIVERY"
    | "DEVICE_PURCHASE"
    | "DEVICE_RENTAL"
    | "DEVICE_ASSIGNMENT"
    | "DEVICE_MAINTENANCE"
    | "DEVICE_SWAP";
  providerLane:
    | "CLINICIAN"
    | "CLINICIAN_STAFF_MEDICAL"
    | "CLINICIAN_STAFF_NON_MEDICAL"
    | "LAB"
    | "PHLEB"
    | "PHARMACY"
    | "RIDER"
    | "PLATFORM"
    | "INVENTORY";
  providerId?: string;
  responsibility?: "CLIENT" | "PATIENT" | "SPLIT" | "PLATFORM";
  currency?: string;
  grossAmountMinor: number;
  sponsorAmountMinor?: number;
  patientAmountMinor?: number;
  platformAmountMinor?: number;
  providerAmountMinor?: number;
  pricingSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  serviceAt?: string;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
};

function asMinor(value: unknown, field: string, fallback = 0) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) {
    throw new Error(`${field}_must_be_numeric`);
  }
  const x = Math.trunc(n);
  if (x < 0) {
    throw new Error(`${field}_must_be_non_negative`);
  }
  return x;
}

function normalizeCurrency(value: unknown) {
  const c = String(value ?? "ZAR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) {
    throw new Error("currency_must_be_iso_4217");
  }
  return c;
}

function parseServiceAt(value: unknown) {
  if (!value) return undefined;
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) {
    throw new Error("serviceAt_invalid");
  }
  return d;
}

function inferResponsibility(args: {
  sponsorAmountMinor: number;
  patientAmountMinor: number;
  platformAmountMinor: number;
  requested?: CreateBillableEventInput["responsibility"];
}) {
  if (args.requested) return args.requested;
  if (args.platformAmountMinor > 0 && args.sponsorAmountMinor === 0 && args.patientAmountMinor === 0) {
    return "PLATFORM" as const;
  }
  if (args.sponsorAmountMinor > 0 && args.patientAmountMinor > 0) {
    return "SPLIT" as const;
  }
  if (args.sponsorAmountMinor > 0) {
    return "CLIENT" as const;
  }
  return "PATIENT" as const;
}

export async function createBillableEvent(input: CreateBillableEventInput) {
  const orgId = input.orgId ?? "org-default";
  const db = dbOrTx(input.tx);

  const grossAmountMinor = asMinor(input.grossAmountMinor, "grossAmountMinor");
  const sponsorAmountMinor = asMinor(input.sponsorAmountMinor, "sponsorAmountMinor", 0);
  const patientAmountMinor = asMinor(input.patientAmountMinor, "patientAmountMinor", 0);
  const platformAmountMinor = asMinor(input.platformAmountMinor, "platformAmountMinor", 0);
  const providerAmountMinor = asMinor(input.providerAmountMinor, "providerAmountMinor", 0);

  const currency = normalizeCurrency(input.currency);
  const serviceAt = parseServiceAt(input.serviceAt);

  if (grossAmountMinor <= 0) {
    throw new Error("grossAmountMinor_must_be_positive");
  }

  if (sponsorAmountMinor + patientAmountMinor > grossAmountMinor) {
    throw new Error("payer_split_exceeds_grossAmountMinor");
  }

  if (providerAmountMinor + platformAmountMinor > grossAmountMinor) {
    throw new Error("allocation_split_exceeds_grossAmountMinor");
  }

  const responsibility = inferResponsibility({
    sponsorAmountMinor,
    patientAmountMinor,
    platformAmountMinor,
    requested: input.responsibility
  });

  const requestHash = softJsonHash({
    orgId,
    clientId: input.clientId ?? null,
    clientMemberId: input.clientMemberId ?? null,
    authorizationId: input.authorizationId ?? null,
    encounterId: input.encounterId ?? null,
    appointmentId: input.appointmentId ?? null,
    labOrderId: input.labOrderId ?? null,
    erxOrderId: input.erxOrderId ?? null,
    carePortOrderId: input.carePortOrderId ?? null,
    deliveryId: input.deliveryId ?? null,
    drawId: input.drawId ?? null,
    deviceId: input.deviceId ?? null,
    patientId: input.patientId ?? null,
    userId: input.userId ?? null,
    serviceType: input.serviceType,
    providerLane: input.providerLane,
    providerId: input.providerId ?? null,
    responsibility,
    currency,
    grossAmountMinor,
    sponsorAmountMinor,
    patientAmountMinor,
    platformAmountMinor,
    providerAmountMinor,
    pricingSnapshot: input.pricingSnapshot ?? null,
    metadata: input.metadata ?? null,
    serviceAt: serviceAt?.toISOString?.() ?? null,
  });

  const existing = await findIdempotentResponse({
    orgId,
    scope: "billable_event.create",
    key: input.idempotencyKey,
    actorUserId: input.userId ?? null,
    requestHash,
    tx: input.tx,
  });

  if (existing) return existing as any;

  const item = await db.billableEvent.create({
    data: {
      orgId,
      clientId: input.clientId,
      clientMemberId: input.clientMemberId,
      authorizationId: input.authorizationId,
      encounterId: input.encounterId,
      appointmentId: input.appointmentId,
      labOrderId: input.labOrderId,
      erxOrderId: input.erxOrderId,
      carePortOrderId: input.carePortOrderId,
      deliveryId: input.deliveryId,
      drawId: input.drawId,
      deviceId: input.deviceId,
      patientId: input.patientId,
      userId: input.userId,
      serviceType: input.serviceType,
      providerLane: input.providerLane,
      providerId: input.providerId,
      responsibility,
      status: "READY",
      currency,
      grossAmountMinor,
      sponsorAmountMinor,
      patientAmountMinor,
      platformAmountMinor,
      providerAmountMinor,
      pricingSnapshot: jsonInput(input.pricingSnapshot),
      metadata: jsonInput(input.metadata),
      serviceAt
    }
  });

  await saveIdempotentResponse({
    orgId,
    scope: "billable_event.create",
    key: input.idempotencyKey,
    actorUserId: input.userId ?? null,
    requestHash,
    response: item,
    tx: input.tx,
  });

  return item;
}