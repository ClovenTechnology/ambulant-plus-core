import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  try {
    const item = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        programs: true,
        coveragePlans: true,
        wallet: true
      }
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch client.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();

    const item = await prisma.client.update({
      where: { id: params.id },
      data: {
        legalName: body.legalName,
        tradingName: body.tradingName,
        status: body.status,
        billingMode: body.billingMode,
        defaultCurrency: body.defaultCurrency,
        country: body.country,
        allowsClaims: body.allowsClaims,
        allowsWalletFunding: body.allowsWalletFunding,
        allowsHybridFunding: body.allowsHybridFunding,
        contractStartAt: body.contractStartAt ? new Date(body.contractStartAt) : undefined,
        contractEndAt: body.contractEndAt ? new Date(body.contractEndAt) : undefined,
        paymentTermsDays: body.paymentTermsDays,
        contactsJson: body.contactsJson,
        configJson: body.configJson,
        metadata: body.metadata
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update client.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}