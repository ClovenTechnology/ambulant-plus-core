import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ok, fail } from "@ambulant/client-core/src/http";
import { requireApiClientRole } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const coveragePlanId = searchParams.get("coveragePlanId") ?? undefined;

    const items = await prisma.coverageServiceRule.findMany({
      where: {
        ...(coveragePlanId ? { coveragePlanId } : {})
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300
    });

    return ok(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch service rules.";
    return fail("coverage_service_rules_fetch_failed", message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orgId = body.orgId ?? "org-default";

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER"],
      { orgId }
    );

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "coverage.service_rule.create",
        status: "blocked",
        orgId,
        entityType: "CoverageServiceRule",
        description: "Coverage service-rule creation blocked by RBAC.",
      });

      return auth.response;
    }

    const actor = auth.actor;

    const item = await prisma.coverageServiceRule.create({
      data: {
        orgId,
        coveragePlanId: body.coveragePlanId,
        serviceType: body.serviceType,
        enabled: body.enabled ?? true,
        decision: body.decision ?? "COVERED",
        sponsorCapMinor: body.sponsorCapMinor,
        memberCopayMinor: body.memberCopayMinor,
        memberCopayPercent: body.memberCopayPercent,
        preauthRequired: body.preauthRequired ?? false,
        limitCount: body.limitCount,
        limitMinor: body.limitMinor,
        limitPeriod: body.limitPeriod,
        allowedVisitModes: body.allowedVisitModes ?? [],
        metadata: body.metadata
      }
    });

    await writeClientAuditLog(req, actor, {
      action: "coverage.service_rule.create",
      status: "success",
      orgId,
      clientId: body.clientId ?? null,
      entityType: "CoverageServiceRule",
      entityId: item.id,
      description: "Coverage service rule created.",
      metadata: {
        coveragePlanId: body.coveragePlanId ?? null,
        serviceType: body.serviceType ?? null,
        decision: body.decision ?? "COVERED",
        preauthRequired: body.preauthRequired ?? false,
      },
    });

    return ok(item, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create service rule.";

    await writeClientAuditLog(req, null, {
      action: "coverage.service_rule.create",
      status: "failed",
      entityType: "CoverageServiceRule",
      description: "Coverage service-rule creation failed.",
      metadata: { error: message },
    });

    return fail("coverage_service_rule_create_failed", message, 500);
  }
}