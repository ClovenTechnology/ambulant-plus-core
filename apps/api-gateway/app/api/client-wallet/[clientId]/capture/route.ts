import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireApiClientRole, forbiddenJson } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

const prisma = new PrismaClient();

type Params = {
  params: {
    clientId: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "FINANCE_MANAGER"]
    );

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "wallet.capture",
        status: "blocked",
        clientId: params.clientId,
        entityType: "ClientWalletAccount",
        entityId: params.clientId,
        description: "Wallet capture blocked by RBAC.",
      });

      return auth.response;
    }

    const actor = auth.actor;

    const amountMinor = Number(body.amountMinor ?? 0);

    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      return NextResponse.json(
        { ok: false, error: "amountMinor must be a positive integer." },
        { status: 400 }
      );
    }

    const wallet = await prisma.clientWalletAccount.findUnique({
      where: { clientId: params.clientId }
    });

    if (!wallet) {
      return NextResponse.json({ ok: false, error: "Wallet not found." }, { status: 404 });
    }

    if (auth.actor.orgId && wallet.orgId !== auth.actor.orgId) {
      return forbiddenJson("cross_org_wallet_access_denied", 403);
    }

    if (wallet.heldMinor < amountMinor) {
      return NextResponse.json({ ok: false, error: "Insufficient held balance." }, { status: 409 });
    }

    const updated = await prisma.clientWalletAccount.update({
      where: { id: wallet.id },
      data: {
        heldMinor: { decrement: amountMinor }
      }
    });

    const tx = await prisma.clientWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CAPTURE",
        amountMinor,
        currency: wallet.currency,
        refType: body.refType,
        refId: body.refId,
        metadata: body.metadata
      }
    });

    await writeClientAuditLog(req, actor, {
      action: "wallet.capture",
      status: "success",
      orgId: wallet.orgId,
      clientId: params.clientId,
      entityType: "ClientWalletAccount",
      entityId: wallet.id,
      description: "Client wallet held funds captured.",
      metadata: {
        amountMinor,
        currency: wallet.currency,
        transactionId: tx.id,
        refType: body.refType ?? null,
        refId: body.refId ?? null,
      },
    });

    return NextResponse.json({ ok: true, wallet: updated, tx });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to capture wallet funds.";
    await writeClientAuditLog(req, null, {
      action: "wallet.capture",
      status: "failed",
      clientId: params.clientId,
      entityType: "ClientWalletAccount",
      entityId: params.clientId,
      description: "Client wallet capture failed.",
      metadata: { error: message },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
