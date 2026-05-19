import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const item = await prisma.clientClaim.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        clientMember: true,
        coveragePlan: true,
        authorization: true,
        lines: {
          include: {
            billableEvent: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
        settlements: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { ok: false, error: "claim_not_found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      item,
      audit: {
        sourceVersion: "client-claim-detail.v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch claim.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}