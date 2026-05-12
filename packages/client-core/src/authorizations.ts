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

function actorUserIdOrThrow(value?: string | null) {
  const actor = String(value || "").trim();

  if (actor) return actor;

  if (process.env.NODE_ENV === "production") {
    throw new Error("actorUserId is required for authorization idempotency.");
  }

  return "dev-client-console-actor";
}

export type CreateAuthorizationInput = {
  orgId?: string;
  clientId: string;
  coveragePlanId?: string;
  clientMemberId?: string;
  userId?: string;
  patientId?: string;
  scopeType:
    | "APPOINTMENT"
    | "ENCOUNTER"
    | "LAB_ORDER"
    | "DRAW"
    | "ERX_ORDER"
    | "CAREPORT_ORDER"
    | "DEVICE_ORDER"
    | "DELIVERY"
    | "BUNDLE";
  scopeId: string;
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
  requestedAmountMinor?: number;
  currency?: string;
  ruleSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
};

export async function createCoverageAuthorization(input: CreateAuthorizationInput) {
  const orgId = input.orgId ?? "org-default";
  const db = dbOrTx(input.tx);
  const actorUserId = actorUserIdOrThrow(input.userId);

  const requestHash = softJsonHash({
    orgId,
    clientId: input.clientId,
    coveragePlanId: input.coveragePlanId ?? null,
    clientMemberId: input.clientMemberId ?? null,
    userId: input.userId ?? null,
    patientId: input.patientId ?? null,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    serviceType: input.serviceType,
    requestedAmountMinor: input.requestedAmountMinor ?? null,
    currency: input.currency ?? "ZAR",
    ruleSnapshot: input.ruleSnapshot ?? null,
    metadata: input.metadata ?? null,
  });

  const existing = await findIdempotentResponse({
    orgId,
    scope: "coverage.authorization.create",
    key: input.idempotencyKey,
    actorUserId,
    requestHash,
    tx: input.tx,
  });

  if (existing) return existing as any;

  const item = await db.coverageAuthorization.create({
    data: {
      orgId,
      clientId: input.clientId,
      coveragePlanId: input.coveragePlanId,
      clientMemberId: input.clientMemberId,
      userId: input.userId,
      patientId: input.patientId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      serviceType: input.serviceType,
      status: "PENDING",
      requestedAmountMinor: input.requestedAmountMinor,
      currency: input.currency ?? "ZAR",
      ruleSnapshot: jsonInput(input.ruleSnapshot),
      metadata: jsonInput(input.metadata)
    }
  });

  await saveIdempotentResponse({
    orgId,
    scope: "coverage.authorization.create",
    key: input.idempotencyKey,
    actorUserId,
    requestHash,
    response: item,
    tx: input.tx,
  });

  return item;
}

export async function approveCoverageAuthorization(args: {
  id: string;
  approvedAmountMinor?: number;
  decisionReason?: string;
  expiresAt?: string | null;
  actorUserId?: string | null;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
}) {
  const db = dbOrTx(args.tx);
  const actorUserId = actorUserIdOrThrow(args.actorUserId);

  const requestHash = softJsonHash({
    id: args.id,
    approvedAmountMinor: args.approvedAmountMinor ?? null,
    decisionReason: args.decisionReason ?? null,
    expiresAt: args.expiresAt ?? null,
  });

  const existing = await findIdempotentResponse({
    scope: "coverage.authorization.approve",
    key: args.idempotencyKey,
    actorUserId,
    requestHash,
    tx: args.tx,
  });

  if (existing) return existing as any;

    const current = await db.coverageAuthorization.findUnique({
    where: { id: args.id },
    select: {
      requestedAmountMinor: true,
    },
  });

  const nextStatus =
    typeof args.approvedAmountMinor === "number" &&
    typeof current?.requestedAmountMinor === "number" &&
    args.approvedAmountMinor < current.requestedAmountMinor
      ? "PARTIALLY_APPROVED"
      : "APPROVED";

  const item = await db.coverageAuthorization.update({
    where: { id: args.id },
    data: {
      status: nextStatus,
      approvedAmountMinor: args.approvedAmountMinor,
      decisionReason: args.decisionReason,
      decidedAt: new Date(),
      expiresAt: args.expiresAt ? new Date(args.expiresAt) : undefined,
    },
  });

  await saveIdempotentResponse({
    scope: "coverage.authorization.approve",
    key: args.idempotencyKey,
    actorUserId,
    requestHash,
    response: item,
    tx: args.tx,
  });

  return item;
}

export async function denyCoverageAuthorization(args: {
  id: string;
  decisionReason: string;
  actorUserId?: string | null;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
}) {
  const db = dbOrTx(args.tx);
  const actorUserId = actorUserIdOrThrow(args.actorUserId);

  const requestHash = softJsonHash({
    id: args.id,
    decisionReason: args.decisionReason,
  });

  const existing = await findIdempotentResponse({
    scope: "coverage.authorization.deny",
    key: args.idempotencyKey,
    actorUserId,
    requestHash,
    tx: args.tx,
  });

  if (existing) return existing as any;

  const item = await db.coverageAuthorization.update({
    where: { id: args.id },
    data: {
      status: "DENIED",
      decisionReason: args.decisionReason,
      decidedAt: new Date()
    }
  });

  await saveIdempotentResponse({
    scope: "coverage.authorization.deny",
    key: args.idempotencyKey,
    actorUserId,
    requestHash,
    response: item,
    tx: args.tx,
  });

  return item;
}

export async function consumeCoverageAuthorization(args: {
  id: string;
  actorUserId?: string | null;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
}) {
  const db = dbOrTx(args.tx);
  const actorUserId = actorUserIdOrThrow(args.actorUserId);

  const requestHash = softJsonHash({
    id: args.id,
    action: "consume",
  });

  const existing = await findIdempotentResponse({
    scope: "coverage.authorization.consume",
    key: args.idempotencyKey,
    actorUserId,
    requestHash,
    tx: args.tx,
  });

  if (existing) return existing as any;

  const item = await db.coverageAuthorization.update({
    where: { id: args.id },
    data: {
      status: "CONSUMED",
      consumedAt: new Date()
    }
  });

  await saveIdempotentResponse({
    scope: "coverage.authorization.consume",
    key: args.idempotencyKey,
    actorUserId,
    requestHash,
    response: item,
    tx: args.tx,
  });

  return item;
}