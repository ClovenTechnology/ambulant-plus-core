import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function minor(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") ?? "org-default";
    const clientId = searchParams.get("clientId") ?? undefined;

    const lines = await prisma.settlementLine.findMany({
      where: {
        settlement: {
          orgId,
          ...(clientId ? { clientId } : {}),
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1000,
    });

    const grouped = new Map<
      string,
      {
        providerLane: string;
        providerId: string | null;
        grossAmountMinor: number;
        netAmountMinor: number;
        lineCount: number;
        latestLineAt: Date | null;
      }
    >();

    for (const line of lines) {
      const key = `${line.providerLane}::${line.providerId ?? "unknown"}`;
      const current = grouped.get(key) ?? {
        providerLane: line.providerLane,
        providerId: line.providerId ?? null,
        grossAmountMinor: 0,
        netAmountMinor: 0,
        lineCount: 0,
        latestLineAt: null,
      };

      current.grossAmountMinor += minor(line.grossAmountMinor);
      current.netAmountMinor += minor(line.netAmountMinor);
      current.lineCount += 1;

      const createdAt = line.createdAt instanceof Date ? line.createdAt : null;
      if (
        createdAt &&
        (!current.latestLineAt || createdAt.getTime() > current.latestLineAt.getTime())
      ) {
        current.latestLineAt = createdAt;
      }

      grouped.set(key, current);
    }

    const items = Array.from(grouped.values()).sort(
      (a, b) => b.netAmountMinor - a.netAmountMinor
    );

    const summary = {
      totalProviders: items.length,
      grossAmountMinor: items.reduce((sum, x) => sum + x.grossAmountMinor, 0),
      netAmountMinor: items.reduce((sum, x) => sum + x.netAmountMinor, 0),
      lineCount: items.reduce((sum, x) => sum + x.lineCount, 0),
    };

    return NextResponse.json({
      ok: true,
      items,
      summary,
      audit: {
        sourceVersion: "settlement-provider-summary.v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch settlement provider summary.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}