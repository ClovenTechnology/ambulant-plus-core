import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireApiClientRole, forbiddenJson } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function asArray(value: unknown): string[] {
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

    settlementGrossMinor: Number(row.metadata?.settlementGrossMinor || 0),
    settlementNetMinor: Number(row.metadata?.settlementNetMinor || 0),
    settlementLineCount: Number(row.metadata?.settlementLineCount || 0),

    claimsCount: Number(row.metadata?.claimsCount || 0),
    submittedAmountMinor: Number(row.metadata?.submittedAmountMinor || 0),
    approvedAmountMinor: Number(row.metadata?.approvedAmountMinor || 0),
    paidAmountMinor: Number(row.metadata?.paidAmountMinor || 0),

    blockers: Array.isArray(row.metadata?.blockers) ? row.metadata.blockers : [],
    riskFlags: Array.isArray(row.metadata?.riskFlags) ? row.metadata.riskFlags : [],

    latestSettlementAt: row.metadata?.latestSettlementAt || null,
    metadata: row.metadata || {},
    source: "provider-network",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = clean(searchParams.get("orgId"), "org-default");
    const clientId = clean(searchParams.get("clientId"));
    const providerLane = clean(searchParams.get("providerLane"));
    const q = clean(searchParams.get("q")).toLowerCase();

    const auth = requireApiClientRole(req, [...READ_ROLES], { orgId });

    if (auth.ok === false) {
      return auth.response;
    }

    const rows = await prisma.providerNetworkRecord.findMany({
      where: {
        orgId,
        ...(clientId ? { clientId } : {}),
        ...(providerLane ? { providerLane: providerLane.toUpperCase() } : {}),
      },
      orderBy: [
        { providerLane: "asc" },
        { displayName: "asc" },
        { createdAt: "desc" },
      ],
      take: 1000,
    });

    const filtered = q
      ? rows.filter((row) => {
          const haystack = [
            row.legalName,
            row.tradingName,
            row.displayName,
            row.providerLane,
            row.providerId,
            row.practiceNumber,
            row.providerCode,
            row.networkStatus,
            row.dspStatus,
            row.contractStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(q);
        })
      : rows;

    const items = filtered.map(rowOut);

    const summary = {
      totalProviders: items.length,
      contracted: items.filter((x) =>
        ["ACTIVE", "CONTRACTED", "PREFERRED"].includes(String(x.contractStatus))
      ).length,
      dspEligible: items.filter((x) => String(x.dspStatus).includes("DSP")).length,
      claimsEnabled: items.filter((x) => x.claimsEnabled).length,
      settlementEnabled: items.filter((x) => x.settlementEnabled).length,
      directSettlementEnabled: items.filter((x) => x.directSettlementEnabled).length,
      missingPracticeNumber: items.filter((x) => !x.practiceNumber).length,
      grossSettlementMinor: items.reduce(
        (sum, x) => sum + Number(x.settlementGrossMinor || 0),
        0
      ),
      netSettlementMinor: items.reduce(
        (sum, x) => sum + Number(x.settlementNetMinor || 0),
        0
      ),
      approvedClaimsMinor: items.reduce(
        (sum, x) => sum + Number(x.approvedAmountMinor || 0),
        0
      ),
    };

    return NextResponse.json({
      ok: true,
      items,
      summary,
      audit: {
        sourceVersion: "provider-network.v1",
        generatedAt: new Date().toISOString(),
        orgId,
        clientId: clientId || null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch provider network.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orgId = clean(body.orgId, "org-default");

    const auth = requireApiClientRole(req, [...WRITE_ROLES], { orgId });

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "provider_network.create",
        status: "blocked",
        orgId,
        entityType: "ProviderNetworkRecord",
        description: "Provider-network create blocked by RBAC.",
      });

      return auth.response;
    }

    const providerLane = clean(body.providerLane).toUpperCase();
    const providerId = clean(body.providerId);
    const legalName = clean(body.legalName || body.name);

    if (!providerLane) {
      return NextResponse.json(
        { ok: false, error: "providerLane_required" },
        { status: 400 }
      );
    }

    if (!providerId) {
      return NextResponse.json(
        { ok: false, error: "providerId_required" },
        { status: 400 }
      );
    }

    if (!legalName) {
      return NextResponse.json(
        { ok: false, error: "legalName_required" },
        { status: 400 }
      );
    }

    const item = await prisma.providerNetworkRecord.create({
      data: {
        orgId,
        clientId: clean(body.clientId) || null,

        providerLane,
        providerType: clean(body.providerType, "ORGANISATION"),
        providerId,
        legalName,
        tradingName: clean(body.tradingName) || null,
        displayName: clean(body.displayName || body.tradingName || legalName),

        practiceNumber: clean(body.practiceNumber) || null,
        providerCode: clean(body.providerCode) || null,
        registrationNumber: clean(body.registrationNumber) || null,
        taxNumber: clean(body.taxNumber) || null,

        country: clean(body.country, "ZA").toUpperCase(),
        currency: clean(body.currency, "ZAR").toUpperCase(),

        networkStatus: clean(body.networkStatus, "NETWORK_REVIEW"),
        dspStatus: clean(body.dspStatus, "NOT_DSP"),
        contractStatus: clean(body.contractStatus, "REVIEW"),
        credentialingStatus: clean(body.credentialingStatus, "PENDING"),
        bankVerificationStatus: clean(body.bankVerificationStatus, "PENDING"),
        riskStatus: clean(body.riskStatus, "NORMAL"),

        claimsEnabled: bool(body.claimsEnabled),
        settlementEnabled: bool(body.settlementEnabled),
        directSettlementEnabled: bool(body.directSettlementEnabled),

        payoutRoute: clean(body.payoutRoute, "AMBULANT_PLUS"),
        payeeEntityType: clean(body.payeeEntityType, "AMBULANT_PLUS"),
        payeeEntityId: clean(body.payeeEntityId) || null,
        settlementCycle: clean(body.settlementCycle, "MONTHLY"),

        acceptedSchemes: asArray(body.acceptedSchemes),
        schemeRuleCodes: asArray(body.schemeRuleCodes),

        effectiveFrom: toDateOrNull(body.effectiveFrom),
        effectiveTo: toDateOrNull(body.effectiveTo),

        metadata:
          body.metadata && typeof body.metadata === "object"
            ? body.metadata
            : {},
      },
    });

    await writeClientAuditLog(req, auth.actor, {
      action: "provider_network.create",
      status: "success",
      orgId,
      clientId: item.clientId,
      entityType: "ProviderNetworkRecord",
      entityId: item.id,
      description: "Provider-network record created.",
      metadata: {
        providerLane: item.providerLane,
        providerId: item.providerId,
        practiceNumber: item.practiceNumber,
        contractStatus: item.contractStatus,
        dspStatus: item.dspStatus,
        payoutRoute: item.payoutRoute,
      },
    });

    return NextResponse.json({ ok: true, item: rowOut(item) }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create provider-network record.";

    await writeClientAuditLog(req, null, {
      action: "provider_network.create",
      status: "failed",
      entityType: "ProviderNetworkRecord",
      description: "Provider-network create failed.",
      metadata: { error: message },
    });

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}