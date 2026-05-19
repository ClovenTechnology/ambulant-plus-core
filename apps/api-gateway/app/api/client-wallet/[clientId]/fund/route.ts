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
    const requestedOrgId = String(body.orgId ?? "org-default");

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "FINANCE_MANAGER"],
      { orgId: requestedOrgId }
    );

    if (auth.ok === false) {
      return auth.response;
    }

    const actor = auth.actor;

    const amountMinor = Number(body.amountMinor ?? 0);
    const currency = String(body.currency ?? "ZAR").toUpperCase();

    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      return NextResponse.json(
        { ok: false, error: "amountMinor must be a positive integer." },
        { status: 400 }
      );
    }

    const wallet = await prisma.clientWalletAccount.upsert({
      where: { clientId: params.clientId },
      update: {
        balanceMinor: {
          increment: amountMinor
        }
      },
      create: {
        clientId: params.clientId,
        orgId: body.orgId ?? "org-default",
        currency,
        status: "ACTIVE",
        balanceMinor: amountMinor
      }
    });

    const tx = await prisma.clientWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "FUNDING",
        amountMinor,
        currency,
        refType: body.refType,
        refId: body.refId,
        metadata: body.metadata
      }
    });

    await writeClientAuditLog(req, actor, {
      action: "wallet.fund",
      status: "success",
      orgId: requestedOrgId,
      clientId: params.clientId,
      entityType: "ClientWalletAccount",
      entityId: wallet.id,
      description: "Client wallet funded.",
      metadata: {
        amountMinor,
        currency,
        transactionId: tx.id,
        refType: body.refType ?? null,
        refId: body.refId ?? null,
      },
    });

    return NextResponse.json({ ok: true, wallet, tx }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fund client wallet.";

    await writeClientAuditLog(req, null, {
      action: "wallet.fund",
      status: "failed",
      entityType: "ClientWalletAccount",
      entityId: params.clientId,
      clientId: params.clientId,
      description: "Client wallet funding failed.",
      metadata: {
        error: message,
      },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}