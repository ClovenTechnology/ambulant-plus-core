import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = {
  params: {
    id: string;
  };
};

export async function POST(_: Request, { params }: Params) {
  try {
    const item = await prisma.clientClaim.update({
      where: { id: params.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date()
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit claim.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}