import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { ok, fail } from "@ambulant/client-core/src/http";
import { requireApiClientRole, forbiddenJson } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const item = await prisma.coverageServiceRule.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return fail("coverage_service_rule_not_found", "Coverage service rule not found.", 404);
    }

    return ok(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch service rule.";
    return fail("coverage_service_rule_fetch_failed", message, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const existing = await prisma.coverageServiceRule.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return fail("coverage_service_rule_not_found", "Coverage service rule not found.", 404);
    }

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER"],
      { orgId: existing.orgId }
    );

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "coverage.service_rule.update",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "CoverageServiceRule",
        entityId: params.id,
        description: "Coverage service-rule update blocked by RBAC.",
      });

      return auth.response;
    }

    if (auth.actor.orgId && existing.orgId !== auth.actor.orgId) {
      await writeClientAuditLog(req, auth.actor, {
        action: "coverage.service_rule.update",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "CoverageServiceRule",
        entityId: params.id,
        description: "Cross-org coverage service-rule update blocked.",
      });

      return forbiddenJson("cross_org_service_rule_access_denied", 403);
    }

    const actor = auth.actor;

    const item = await prisma.coverageServiceRule.update({
      where: { id: params.id },
      data: {
        enabled: body.enabled,
        decision: body.decision,
        sponsorCapMinor: body.sponsorCapMinor,
        memberCopayMinor: body.memberCopayMinor,
        memberCopayPercent: body.memberCopayPercent,
        preauthRequired: body.preauthRequired,
        limitCount: body.limitCount,
        limitMinor: body.limitMinor,
        limitPeriod: body.limitPeriod,
        allowedVisitModes: body.allowedVisitModes,
        metadata: body.metadata,
      },
    });

    await writeClientAuditLog(req, actor, {
      action: "coverage.service_rule.update",
      status: "success",
      orgId: existing.orgId,
      entityType: "CoverageServiceRule",
      entityId: params.id,
      description: "Coverage service rule updated.",
      metadata: {
        coveragePlanId: existing.coveragePlanId,
        serviceType: existing.serviceType,
        before: {
          enabled: existing.enabled,
          decision: existing.decision,
          sponsorCapMinor: existing.sponsorCapMinor,
          memberCopayMinor: existing.memberCopayMinor,
          preauthRequired: existing.preauthRequired,
        },
        after: {
          enabled: item.enabled,
          decision: item.decision,
          sponsorCapMinor: item.sponsorCapMinor,
          memberCopayMinor: item.memberCopayMinor,
          preauthRequired: item.preauthRequired,
        },
      },
    });

    return ok(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update service rule.";

    await writeClientAuditLog(req, null, {
      action: "coverage.service_rule.update",
      status: "failed",
      entityType: "CoverageServiceRule",
      entityId: params.id,
      description: "Coverage service-rule update failed.",
      metadata: { error: message },
    });

    return fail("coverage_service_rule_update_failed", message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const existing = await prisma.coverageServiceRule.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return fail("coverage_service_rule_not_found", "Coverage service rule not found.", 404);
    }

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER"],
      { orgId: existing.orgId }
    );

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "coverage.service_rule.delete",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "CoverageServiceRule",
        entityId: params.id,
        description: "Coverage service-rule delete blocked by RBAC.",
      });

      return auth.response;
    }

    if (auth.actor.orgId && existing.orgId !== auth.actor.orgId) {
      await writeClientAuditLog(req, auth.actor, {
        action: "coverage.service_rule.delete",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "CoverageServiceRule",
        entityId: params.id,
        description: "Cross-org coverage service-rule delete blocked.",
      });

      return forbiddenJson("cross_org_service_rule_access_denied", 403);
    }

    const item = await prisma.coverageServiceRule.delete({
      where: { id: params.id },
    });

    await writeClientAuditLog(req, auth.actor, {
      action: "coverage.service_rule.delete",
      status: "success",
      orgId: existing.orgId,
      entityType: "CoverageServiceRule",
      entityId: params.id,
      description: "Coverage service rule deleted.",
      metadata: {
        coveragePlanId: existing.coveragePlanId,
        serviceType: existing.serviceType,
        decision: existing.decision,
      },
    });

    return ok(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete service rule.";

    await writeClientAuditLog(req, null, {
      action: "coverage.service_rule.delete",
      status: "failed",
      entityType: "CoverageServiceRule",
      entityId: params.id,
      description: "Coverage service-rule delete failed.",
      metadata: { error: message },
    });

    return fail("coverage_service_rule_delete_failed", message, 500);
  }
}