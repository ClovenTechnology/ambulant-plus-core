import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireApiClientRole, forbiddenJson } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

const READ_ROLES = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "PROVIDER_MANAGER",
  "CLAIMS_MANAGER",
  "FINANCE_MANAGER",
  "READ_ONLY",
] as const;

const WRITE_ROLES = ["ORG_OWNER", "ORG_ADMIN", "PROVIDER_MANAGER"] as const;

function clean(value: unknown, fallback = "") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function boolOrUndefined(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

function asArrayOrUndefined(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((x) => String(x ?? "").trim()).filter(Boolean))
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[,\n|;]/g)
          .map((x) => x.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

function toDateOrNull(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

function rowOut(row: any) {
  return {
    key: `${row.providerLane}::${row.providerId}`,
    id: row.id,
    orgId: row.orgId,
    clientId: row.clientId,
    providerLane: row.providerLane,
    providerType: row.providerType,
    providerId: row.providerId,
    name: row.displayName || row.tradingName || row.legalName,
    legalName: row.legalName,
    tradingName: row.tradingName,
    displayName: row.displayName,
    discipline: row.metadata?.discipline || row.providerLane,
    practiceName: row.tradingName || row.legalName,
    practiceNumber: row.practiceNumber,
    providerCode: row.providerCode,
    networkStatus: row.networkStatus,
    dspStatus: row.dspStatus,
    contractStatus: row.contractStatus,
    credentialingStatus: row.credentialingStatus,
    bankVerificationStatus: row.bankVerificationStatus,
    riskStatus: row.riskStatus,
    claimsEnabled: row.claimsEnabled,
    settlementEnabled: row.settlementEnabled,
    directSettlementEnabled: row.directSettlementEnabled,
    payoutRoute: row.payoutRoute,
    payeeEntityType: row.payeeEntityType,
    payeeEntityId: row.payeeEntityId,
    settlementCycle: row.settlementCycle,
    acceptedSchemes: row.acceptedSchemes || [],
    schemeRuleCodes: row.schemeRuleCodes || [],
    metadata: row.metadata || {},
    source: "provider-network",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const existing = await prisma.providerNetworkRecord.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "provider_network_record_not_found" },
        { status: 404 }
      );
    }

    const auth = requireApiClientRole(req, [...READ_ROLES], {
      orgId: existing.orgId,
    });

    if (auth.ok === false) {
      return auth.response;
    }

    if (auth.actor.orgId && existing.orgId !== auth.actor.orgId) {
      return forbiddenJson("cross_org_provider_network_access_denied", 403);
    }

    return NextResponse.json({ ok: true, item: rowOut(existing) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch provider-network record.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const existing = await prisma.providerNetworkRecord.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "provider_network_record_not_found" },
        { status: 404 }
      );
    }

    const auth = requireApiClientRole(req, [...WRITE_ROLES], {
      orgId: existing.orgId,
    });

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "provider_network.update",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "ProviderNetworkRecord",
        entityId: existing.id,
        description: "Provider-network update blocked by RBAC.",
      });

      return auth.response;
    }

    if (auth.actor.orgId && existing.orgId !== auth.actor.orgId) {
      await writeClientAuditLog(req, auth.actor, {
        action: "provider_network.update",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "ProviderNetworkRecord",
        entityId: existing.id,
        description: "Cross-org provider-network update blocked.",
      });

      return forbiddenJson("cross_org_provider_network_access_denied", 403);
    }

    const claimsEnabled = boolOrUndefined(body.claimsEnabled);
    const settlementEnabled = boolOrUndefined(body.settlementEnabled);
    const directSettlementEnabled = boolOrUndefined(body.directSettlementEnabled);

    const item = await prisma.providerNetworkRecord.update({
      where: { id: params.id },
      data: {
        ...(body.clientId !== undefined ? { clientId: clean(body.clientId) || null } : {}),
        ...(body.providerLane !== undefined ? { providerLane: clean(body.providerLane).toUpperCase() } : {}),
        ...(body.providerType !== undefined ? { providerType: clean(body.providerType, existing.providerType) } : {}),
        ...(body.providerId !== undefined ? { providerId: clean(body.providerId, existing.providerId) } : {}),
        ...(body.legalName !== undefined ? { legalName: clean(body.legalName, existing.legalName) } : {}),
        ...(body.tradingName !== undefined ? { tradingName: clean(body.tradingName) || null } : {}),
        ...(body.displayName !== undefined ? { displayName: clean(body.displayName, existing.displayName) } : {}),

        ...(body.practiceNumber !== undefined ? { practiceNumber: clean(body.practiceNumber) || null } : {}),
        ...(body.providerCode !== undefined ? { providerCode: clean(body.providerCode) || null } : {}),
        ...(body.registrationNumber !== undefined ? { registrationNumber: clean(body.registrationNumber) || null } : {}),
        ...(body.taxNumber !== undefined ? { taxNumber: clean(body.taxNumber) || null } : {}),

        ...(body.country !== undefined ? { country: clean(body.country, "ZA").toUpperCase() } : {}),
        ...(body.currency !== undefined ? { currency: clean(body.currency, "ZAR").toUpperCase() } : {}),

        ...(body.networkStatus !== undefined ? { networkStatus: clean(body.networkStatus, existing.networkStatus) } : {}),
        ...(body.dspStatus !== undefined ? { dspStatus: clean(body.dspStatus, existing.dspStatus) } : {}),
        ...(body.contractStatus !== undefined ? { contractStatus: clean(body.contractStatus, existing.contractStatus) } : {}),
        ...(body.credentialingStatus !== undefined ? { credentialingStatus: clean(body.credentialingStatus, existing.credentialingStatus) } : {}),
        ...(body.bankVerificationStatus !== undefined ? { bankVerificationStatus: clean(body.bankVerificationStatus, existing.bankVerificationStatus) } : {}),
        ...(body.riskStatus !== undefined ? { riskStatus: clean(body.riskStatus, existing.riskStatus) } : {}),

        ...(claimsEnabled !== undefined ? { claimsEnabled } : {}),
        ...(settlementEnabled !== undefined ? { settlementEnabled } : {}),
        ...(directSettlementEnabled !== undefined ? { directSettlementEnabled } : {}),

        ...(body.payoutRoute !== undefined ? { payoutRoute: clean(body.payoutRoute, existing.payoutRoute) } : {}),
        ...(body.payeeEntityType !== undefined ? { payeeEntityType: clean(body.payeeEntityType, existing.payeeEntityType) } : {}),
        ...(body.payeeEntityId !== undefined ? { payeeEntityId: clean(body.payeeEntityId) || null } : {}),
        ...(body.settlementCycle !== undefined ? { settlementCycle: clean(body.settlementCycle, existing.settlementCycle) } : {}),

        ...(body.acceptedSchemes !== undefined ? { acceptedSchemes: asArrayOrUndefined(body.acceptedSchemes) || [] } : {}),
        ...(body.schemeRuleCodes !== undefined ? { schemeRuleCodes: asArrayOrUndefined(body.schemeRuleCodes) || [] } : {}),

        ...(body.effectiveFrom !== undefined ? { effectiveFrom: toDateOrNull(body.effectiveFrom) } : {}),
        ...(body.effectiveTo !== undefined ? { effectiveTo: toDateOrNull(body.effectiveTo) } : {}),

        ...(body.metadata !== undefined && typeof body.metadata === "object"
          ? { metadata: body.metadata }
          : {}),
      },
    });

    await writeClientAuditLog(req, auth.actor, {
      action: "provider_network.update",
      status: "success",
      orgId: existing.orgId,
      clientId: existing.clientId,
      entityType: "ProviderNetworkRecord",
      entityId: existing.id,
      description: "Provider-network record updated.",
      metadata: {
        providerLane: existing.providerLane,
        providerId: existing.providerId,
        before: {
          contractStatus: existing.contractStatus,
          dspStatus: existing.dspStatus,
          practiceNumber: existing.practiceNumber,
          payoutRoute: existing.payoutRoute,
          directSettlementEnabled: existing.directSettlementEnabled,
        },
        after: {
          contractStatus: item.contractStatus,
          dspStatus: item.dspStatus,
          practiceNumber: item.practiceNumber,
          payoutRoute: item.payoutRoute,
          directSettlementEnabled: item.directSettlementEnabled,
        },
      },
    });

    return NextResponse.json({ ok: true, item: rowOut(item) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update provider-network record.";

    await writeClientAuditLog(req, null, {
      action: "provider_network.update",
      status: "failed",
      entityType: "ProviderNetworkRecord",
      entityId: params.id,
      description: "Provider-network update failed.",
      metadata: { error: message },
    });

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const existing = await prisma.providerNetworkRecord.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "provider_network_record_not_found" },
        { status: 404 }
      );
    }

    const auth = requireApiClientRole(req, [...WRITE_ROLES], {
      orgId: existing.orgId,
    });

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "provider_network.delete",
        status: "blocked",
        orgId: existing.orgId,
        entityType: "ProviderNetworkRecord",
        entityId: existing.id,
        description: "Provider-network delete blocked by RBAC.",
      });

      return auth.response;
    }

    if (auth.actor.orgId && existing.orgId !== auth.actor.orgId) {
      return forbiddenJson("cross_org_provider_network_access_denied", 403);
    }

    const item = await prisma.providerNetworkRecord.delete({
      where: { id: params.id },
    });

    await writeClientAuditLog(req, auth.actor, {
      action: "provider_network.delete",
      status: "success",
      orgId: existing.orgId,
      clientId: existing.clientId,
      entityType: "ProviderNetworkRecord",
      entityId: existing.id,
      description: "Provider-network record deleted.",
      metadata: {
        providerLane: existing.providerLane,
        providerId: existing.providerId,
        practiceNumber: existing.practiceNumber,
      },
    });

    return NextResponse.json({ ok: true, item: rowOut(item) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete provider-network record.";

    await writeClientAuditLog(req, null, {
      action: "provider_network.delete",
      status: "failed",
      entityType: "ProviderNetworkRecord",
      entityId: params.id,
      description: "Provider-network delete failed.",
      metadata: { error: message },
    });

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}