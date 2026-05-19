import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const item = await prisma.clientClaim.update({
      where: { id: params.id },
      data: {
        status: body.status ?? "APPROVED",
        approvedAmountMinor: body.approvedAmountMinor ?? 0,
        responsePayload: body.responsePayload,
        notes: body.notes,
        decidedAt: new Date()
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to adjudicate claim.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}