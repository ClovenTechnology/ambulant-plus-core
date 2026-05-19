import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") ?? "org-default";
    const clientId = searchParams.get("clientId") ?? undefined;

    const items = await prisma.coveragePlan.findMany({
      where: {
        orgId,
        ...(clientId ? { clientId } : {})
      },
      include: {
        serviceRules: true
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch coverage plans.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const item = await prisma.coveragePlan.create({
      data: {
        orgId: body.orgId ?? "org-default",
        clientId: body.clientId,
        clientProgramId: body.clientProgramId,
        name: body.name,
        description: body.description,
        status: body.status ?? "DRAFT",
        currency: body.currency ?? "ZAR",
        annualLimitMinor: body.annualLimitMinor,
        monthlyLimitMinor: body.monthlyLimitMinor,
        lifetimeLimitMinor: body.lifetimeLimitMinor,
        requiresEligibility: body.requiresEligibility ?? true,
        requiresConsent: body.requiresConsent ?? true,
        metadata: body.metadata
      }
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create coverage plan.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}