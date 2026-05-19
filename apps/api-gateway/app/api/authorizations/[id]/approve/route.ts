import { NextRequest, NextResponse } from "next/server";
import { approveCoverageAuthorization } from "@ambulant/client-core/src/authorizations";
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from "@/src/lib/identity";
import { requireApiClientRole } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "CARE_COORDINATOR"]
    );

    if (auth.ok === false) {
      return auth.response;
    }

    const actor = auth.actor;

    const body = await req.json().catch(() => ({}));
    const idempotencyKey = req.headers.get("x-idempotency-key");

    const item = await approveCoverageAuthorization({
      id: params.id,
      approvedAmountMinor: body?.approvedAmountMinor,
      decisionReason: body?.decisionReason,
      expiresAt: body?.expiresAt ?? null,
      actorUserId: who.uid ?? null,
      idempotencyKey,
    });

    await writeClientAuditLog(req, actor, {
      action: "authorization.approve",
      status: "success",
      orgId: actor.orgId,
      clientId: (item as any)?.clientId ?? null,
      entityType: "CoverageAuthorization",
      entityId: params.id,
      description: "Coverage authorization approved.",
      metadata: {
        approvedAmountMinor: body?.approvedAmountMinor ?? null,
        hasDecisionReason: Boolean(body?.decisionReason),
        expiresAt: body?.expiresAt ?? null,
        idempotencyKey: idempotencyKey ?? null,
        statusAfter: (item as any)?.status ?? null,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve authorization.";

    const status =
      message === "Unauthorized"
        ? 401
        : message === "idempotency_key_reused_with_different_payload"
        ? 409
        : 500;

    await writeClientAuditLog(req, null, {
      action: "authorization.approve",
      status: "failed",
      entityType: "CoverageAuthorization",
      entityId: params.id,
      description: "Coverage authorization approval failed.",
      metadata: {
        error: message,
      },
    });

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
