import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const items = await prisma.clientClaimLine.findMany({
      where: { claimId: params.id },
      include: {
        billableEvent: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch claim lines.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const item = await prisma.clientClaimLine.create({
      data: {
        claimId: params.id,
        billableEventId: body.billableEventId,
        submittedAmountMinor: body.submittedAmountMinor ?? 0,
        approvedAmountMinor: body.approvedAmountMinor ?? 0,
        paidAmountMinor: body.paidAmountMinor ?? 0,
        rejectionReason: body.rejectionReason,
        metadata: body.metadata
      }
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create claim line.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}