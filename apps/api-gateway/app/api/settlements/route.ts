import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function minor(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSettlement(item: any) {
  const lines = Array.isArray(item.lines) ? item.lines : [];

  const grossFromLines = lines.reduce(
    (sum: number, line: any) => sum + minor(line.grossAmountMinor),
    0
  );

  const netFromLines = lines.reduce(
    (sum: number, line: any) => sum + minor(line.netAmountMinor),
    0
  );

  const grossAmountMinor = minor(
    item.grossAmountMinor ?? item.grossMinor ?? grossFromLines
  );

  const netAmountMinor = minor(
    item.netAmountMinor ??
      item.netMinor ??
      item.netClinicianMinor ??
      item.clinicianShareMinor ??
      netFromLines
  );

  return {
    ...item,
    grossAmountMinor,
    netAmountMinor,
    platformAmountMinor: minor(item.platformShareMinor ?? item.platformAmountMinor),
    clinicianAmountMinor: minor(item.clinicianShareMinor ?? item.clinicianAmountMinor),
    staffAmountMinor: minor(item.staffShareMinor ?? item.staffAmountMinor),
    providerLane: item.metadata?.providerLane ?? "MIXED",
    providerId: item.metadata?.providerId ?? null,
    billableEventCount: item.metadata?.billableEventCount ?? lines.length,
    lineCount: lines.length,
    remittanceRef:
      item.remittanceRef ??
      item.externalReference ??
      item.metadata?.remittanceRef ??
      null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") ?? "org-default";
    const clientId = searchParams.get("clientId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const rawItems = await prisma.settlementRecord.findMany({
      where: {
        orgId,
        ...(clientId ? { clientId } : {}),
        ...(status ? { status: status.toUpperCase() as never } : {}),
      },
      include: {
        lines: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });

    const items = rawItems.map(normalizeSettlement);

    const summary = {
      total: items.length,
      readyForPayout: items.filter((x) =>
        ["READY_FOR_PAYOUT", "READY", "PENDING"].includes(String(x.status || ""))
      ).length,
      paid: items.filter((x) =>
        ["PAID", "SETTLED", "COMPLETED"].includes(String(x.status || ""))
      ).length,
      failed: items.filter((x) =>
        ["FAILED", "REJECTED", "CANCELLED"].includes(String(x.status || ""))
      ).length,
      grossAmountMinor: items.reduce((sum, x) => sum + minor(x.grossAmountMinor), 0),
      netAmountMinor: items.reduce((sum, x) => sum + minor(x.netAmountMinor), 0),
      platformAmountMinor: items.reduce((sum, x) => sum + minor(x.platformAmountMinor), 0),
      lineCount: items.reduce((sum, x) => sum + minor(x.lineCount), 0),
    };

    return NextResponse.json({
      ok: true,
      items,
      summary,
      audit: {
        sourceVersion: "settlements.v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch settlements.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}