import crypto from "node:crypto";
import prisma, { PrismaTx, dbOrTx } from "./prisma";

export type IdempotencyScope =
  | "appointments.book"
  | "coverage.authorization.create"
  | "coverage.authorization.approve"
  | "coverage.authorization.deny"
  | "coverage.authorization.consume"
  | "billable_event.create"
  | "claim.build"
  | "careport.bill"
  | "medreach.bill"
  | "wallet.fund"
  | "wallet.reserve"
  | "wallet.release"
  | "wallet.capture";

export function softJsonHash(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? {}))
    .digest("hex");
}

export async function findIdempotentResponse(args: {
  orgId?: string;
  scope: IdempotencyScope | string;
  key?: string | null;
  actorUserId?: string | null;
  requestHash: string;
  tx?: PrismaTx;
}) {
  if (!args.key) return null;

  const db = dbOrTx(args.tx);
  const orgId = args.orgId ?? "org-default";

  const existing = await db.idempotencyKey.findFirst({
    where: {
      orgId,
      scope: args.scope,
      key: args.key,
      actorUserId: args.actorUserId ?? null,
    },
  });

  if (!existing) return null;

  if (existing.requestHash !== args.requestHash) {
    throw new Error("idempotency_key_reused_with_different_payload");
  }

  return existing.response;
}

export async function saveIdempotentResponse(args: {
  orgId?: string;
  scope: IdempotencyScope | string;
  key?: string | null;
  actorUserId?: string | null;
  requestHash: string;
  response: unknown;
  tx?: PrismaTx;
}) {
  if (!args.key) return null;

  const db = dbOrTx(args.tx);
  const orgId = args.orgId ?? "org-default";

  return db.idempotencyKey.upsert({
    where: {
      orgId_scope_key_actorUserId: {
        orgId,
        scope: args.scope,
        key: args.key,
        actorUserId: args.actorUserId ?? null,
      },
    },
    update: {
      requestHash: args.requestHash,
      response: args.response as any,
    },
    create: {
      orgId,
      scope: args.scope,
      key: args.key,
      actorUserId: args.actorUserId ?? null,
      requestHash: args.requestHash,
      response: args.response as any,
    },
  });
}