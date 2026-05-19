import { NextRequest, NextResponse } from "next/server";
import { denyCoverageAuthorization } from "@ambulant/client-core/src/authorizations";
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
      await writeClientAuditLog(req, null, {
        action: "authorization.deny",
        status: "blocked",
        entityType: "CoverageAuthorization",
        entityId: params.id,
        description: "Authorization denial blocked by RBAC.",
      });

      return auth.response;
    }

    const actor = auth.actor;

    const body = await req.json();
    const idempotencyKey = req.headers.get("x-idempotency-key");

    if (!body?.decisionReason || typeof body.decisionReason !== "string") {
      return NextResponse.json(
        { ok: false, error: "decisionReason is required." },
        { status: 400 }
      );
    }

    const item = await denyCoverageAuthorization({
      id: params.id,
      decisionReason: body.decisionReason,
      actorUserId: who.uid ?? null,
      idempotencyKey,
    });

    await writeClientAuditLog(req, actor, {
      action: "authorization.deny",
      status: "success",
      orgId: actor.orgId,
      clientId: (item as any)?.clientId ?? null,
      entityType: "CoverageAuthorization",
      entityId: params.id,
      description: "Coverage authorization denied.",
      metadata: {
        hasDecisionReason: Boolean(body?.decisionReason),
        idempotencyKey: idempotencyKey ?? null,
        statusAfter: (item as any)?.status ?? null,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deny authorization.";

    const status =
      message === "Unauthorized"
        ? 401
        : message === "idempotency_key_reused_with_different_payload"
        ? 409
        : 500;

    await writeClientAuditLog(req, null, {
      action: "authorization.deny",
      status: "failed",
      entityType: "CoverageAuthorization",
      entityId: params.id,
      description: "Coverage authorization denial failed.",
      metadata: { error: message },
    });

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}