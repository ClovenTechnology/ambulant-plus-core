import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = {
  params: {
    clientId: string;
  };
};

export async function GET(_: NextRequest, { params }: Params) {
  try {
    let item = await prisma.clientWalletAccount.findUnique({
      where: { clientId: params.clientId },
      include: {
        transactions: {
          orderBy: [{ createdAt: "desc" }],
          take: 100
        }
      }
    });

    if (!item) {
      item = await prisma.clientWalletAccount.create({
        data: {
          clientId: params.clientId,
          orgId: "org-default",
          currency: "ZAR",
          status: "ACTIVE"
        },
        include: {
          transactions: true
        }
      });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch client wallet.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}