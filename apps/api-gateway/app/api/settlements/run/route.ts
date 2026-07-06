import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { requireApiClientRole } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dmmfModel(name: string) {
  return (Prisma as any).dmmf?.datamodel?.models?.find(
    (model: any) => model.name === name
  );
}

function dmmfEnumValues(name: string): string[] {
  const values =
    (Prisma as any).dmmf?.datamodel?.enums?.find(
      (item: any) => item.name === name
    )?.values || [];

  return values.map((item: any) => String(item.name || item));
}

function modelHasField(modelName: string, fieldName: string) {
  const model = dmmfModel(modelName);
  return Boolean(model?.fields?.some((field: any) => field.name === fieldName));
}

function settlementStatusForCreate() {
  const values = dmmfEnumValues("SettlementStatus");

  if (values.includes("READY_FOR_PAYOUT")) return "READY_FOR_PAYOUT";
  if (values.includes("PENDING")) return "PENDING";
  if (values.includes("OPEN")) return "OPEN";
  if (values.includes("APPROVED")) return "APPROVED";

  return values[0] || "PENDING";
}

function settlementPartyTypeForCreate() {
  const values = dmmfEnumValues("SettlementPartyType");

  if (values.includes("CLIENT")) return "CLIENT";
  if (values.includes("PLATFORM")) return "PLATFORM";
  if (values.includes("PATIENT")) return "PATIENT";

  return values[0] || "CLIENT";
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function settlementData(row: {
  orgId: string;
  clientId?: string | null;
  providerLane: string;
  providerId?: string | null;
  currency: string;
  grossAmountMinor: number;
  netAmountMinor: number;
  billableEventIds: string[];
}) {
  const data: Record<string, any> = {
    orgId: row.orgId,
    currency: row.currency || "ZAR",
    status: settlementStatusForCreate(),
    metadata: {
      providerLane: row.providerLane,
      providerId: row.providerId || null,
      billableEventCount: row.billableEventIds.length,
      billableEventIds: row.billableEventIds,
      source: "settlements.run",
    },
  };

  if (modelHasField("SettlementRecord", "clientId") && row.clientId) {
    data.clientId = row.clientId;
  }

  if (modelHasField("SettlementRecord", "grossAmountMinor")) {
    data.grossAmountMinor = row.grossAmountMinor;
  }

  if (modelHasField("SettlementRecord", "grossMinor")) {
    data.grossMinor = row.grossAmountMinor;
  }

  if (modelHasField("SettlementRecord", "netAmountMinor")) {
    data.netAmountMinor = row.netAmountMinor;
  }

  if (modelHasField("SettlementRecord", "netMinor")) {
    data.netMinor = row.netAmountMinor;
  }

  if (modelHasField("SettlementRecord", "platformShareMinor")) {
    data.platformShareMinor = 0;
  }

  if (modelHasField("SettlementRecord", "clinicianShareMinor")) {
    data.clinicianShareMinor = row.netAmountMinor;
  }

  if (modelHasField("SettlementRecord", "staffShareMinor")) {
    data.staffShareMinor = 0;
  }

  if (modelHasField("SettlementRecord", "netClinicianMinor")) {
    data.netClinicianMinor = row.netAmountMinor;
  }

  if (modelHasField("SettlementRecord", "settlementPartyType")) {
    data.settlementPartyType = settlementPartyTypeForCreate();
  }

  if (modelHasField("SettlementRecord", "settlementPartyId")) {
    data.settlementPartyId =
      row.clientId || row.providerId || row.providerLane || "unknown";
  }

  if (modelHasField("SettlementRecord", "clinicianId")) {
    data.clinicianId =
      row.providerLane === "CLINICIAN" && row.providerId
        ? row.providerId
        : "system-settlement";
  }

  if (modelHasField("SettlementRecord", "settledAt")) {
    data.settledAt = new Date();
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedOrgId = String(
      body.orgId ||
        body.org_id ||
        req.headers.get("x-ambulant-org-id") ||
        req.headers.get("x-org-id") ||
        "",
    ).trim();

    const auth = requestedOrgId
      ? requireApiClientRole(
          req,
          ["ORG_OWNER", "ORG_ADMIN", "FINANCE_MANAGER"],
          { orgId: requestedOrgId },
        )
      : requireApiClientRole(req, ["ORG_OWNER", "ORG_ADMIN", "FINANCE_MANAGER"]);

    if (auth.ok === false) {
      return auth.response;
    }

    const actor = auth.actor;
    const orgId = requestedOrgId || String((actor as any)?.orgId || "").trim();

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "orgId_required" },
        { status: 400 },
      );
    }
    const clientId = body.clientId ?? undefined;

    const billableEvents = await prisma.billableEvent.findMany({
      where: {
        orgId,
        status: { in: ["READY", "CLAIMED"] },
        ...(clientId ? { clientId } : {}),
      },
      orderBy: [{ createdAt: "asc" }],
      take: 1000,
    });

    if (billableEvents.length === 0) {
      await writeClientAuditLog(req, actor, {
        action: "settlements.run",
        status: "empty",
        orgId,
        clientId: clientId ?? null,
        entityType: "SettlementRecord",
        description: "Settlement run completed with no READY or CLAIMED billable events.",
        metadata: {
          createdCount: 0,
        },
      });

      return NextResponse.json({
        ok: true,
        createdCount: 0,
        created: [],
        message:
          "No READY or CLAIMED billable events found for settlement batching.",
      });
    }

    const grouped = new Map<
      string,
      {
        clientId?: string | null;
        providerLane: string;
        providerId?: string | null;
        currency: string;
        grossAmountMinor: number;
        netAmountMinor: number;
        billableEventIds: string[];
      }
    >();

    for (const evt of billableEvents) {
      const key = [
        evt.clientId ?? "no-client",
        evt.providerLane,
        evt.providerId ?? "unknown",
        evt.currency ?? "ZAR",
      ].join("::");

      const row = grouped.get(key) ?? {
        clientId: evt.clientId ?? null,
        providerLane: evt.providerLane,
        providerId: evt.providerId ?? null,
        currency: evt.currency ?? "ZAR",
        grossAmountMinor: 0,
        netAmountMinor: 0,
        billableEventIds: [],
      };

      row.grossAmountMinor += money(evt.grossAmountMinor);
      row.netAmountMinor += money(evt.providerAmountMinor);
      row.billableEventIds.push(evt.id);

      grouped.set(key, row);
    }

    const created: any[] = [];

    for (const row of grouped.values()) {
      const settlement = await prisma.settlementRecord.create({
        data: settlementData({
          ...row,
          orgId,
          clientId: row.clientId ?? clientId ?? null,
        }) as any,
      });

      for (const billableEventId of row.billableEventIds) {
        const evt = billableEvents.find((x) => x.id === billableEventId);
        if (!evt) continue;

        await prisma.settlementLine.create({
          data: {
            settlementId: settlement.id,
            billableEventId: evt.id,
            providerLane: evt.providerLane,
            providerId: evt.providerId,
            grossAmountMinor: money(evt.grossAmountMinor),
            netAmountMinor: money(evt.providerAmountMinor),
            metadata: {
              ...(evt.metadata && typeof evt.metadata === "object"
                ? (evt.metadata as Record<string, any>)
                : {}),
              source: "settlements.run",
              billableEventStatusBeforeSettlement: evt.status,
            },
          },
        });

        await prisma.billableEvent.update({
          where: { id: evt.id },
          data: {
            status: "SETTLED",
          },
        });
      }

      created.push(settlement);
    }

    await writeClientAuditLog(req, actor, {
      action: "settlements.run",
      status: "success",
      orgId,
      clientId: clientId ?? null,
      entityType: "SettlementRecord",
      description: "Settlement batch run completed.",
      metadata: {
        createdCount: created.length,
        billableEventCount: billableEvents.length,
        settlementIds: created.map((item) => item.id),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        createdCount: created.length,
        created,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run settlements.";

    await writeClientAuditLog(req, null, {
      action: "settlements.run",
      status: "failed",
      entityType: "SettlementRecord",
      description: "Settlement batch run failed.",
      metadata: {
        error: message,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint:
          "Settlement batching failed at runtime. Check SettlementRecord required fields, SettlementStatus enum values, and billable event status values.",
      },
      { status: 500 }
    );
  }
}