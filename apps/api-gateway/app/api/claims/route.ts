import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTake(value: string | null) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 50;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = searchParams.get("orgId") ?? "org-default";
    const clientId = searchParams.get("clientId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const take = parseTake(searchParams.get("take"));

    const items = await prisma.clientClaim.findMany({
      where: {
        orgId,
        ...(clientId ? { clientId } : {}),
        ...(status ? { status: status.toUpperCase() as never } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            tradingName: true,
            type: true,
            status: true,
          },
        },
        clientMember: {
          select: {
            id: true,
            memberNumber: true,
            employeeNumber: true,
            dependentCode: true,
            principalMemberNumber: true,
            memberKind: true,
            memberStatus: true,
            metadata: true,
          },
        },
        coveragePlan: {
          select: {
            id: true,
            name: true,
            status: true,
            currency: true,
          },
        },
        authorization: {
          select: {
            id: true,
            status: true,
            serviceType: true,
            requestedAmountMinor: true,
            approvedAmountMinor: true,
            decisionReason: true,
            preauthReference: true,
          },
        },
        lines: {
          include: {
            billableEvent: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take,
    });

    const summary = {
      total: items.length,
      submitted: items.filter((x) => x.status === "SUBMITTED").length,
      inReview: items.filter((x) =>
        ["RECEIVED", "IN_REVIEW"].includes(String(x.status || ""))
      ).length,
      approved: items.filter((x) =>
        ["APPROVED", "PARTIALLY_APPROVED"].includes(String(x.status || ""))
      ).length,
      paid: items.filter((x) => x.status === "PAID").length,
      rejected: items.filter((x) =>
        ["REJECTED", "DENIED"].includes(String(x.status || ""))
      ).length,
      submittedAmountMinor: items.reduce(
        (sum, x) => sum + (x.submittedAmountMinor || 0),
        0
      ),
      approvedAmountMinor: items.reduce(
        (sum, x) => sum + (x.approvedAmountMinor || 0),
        0
      ),
      paidAmountMinor: items.reduce(
        (sum, x) => sum + (x.paidAmountMinor || 0),
        0
      ),
      memberResponsibilityMinor: items.reduce(
        (sum, x) => sum + (x.memberResponsibilityMinor || 0),
        0
      ),
    };

    return NextResponse.json({
      ok: true,
      items,
      summary,
      audit: {
        sourceVersion: "client-claims.v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch claims.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const item = await prisma.clientClaim.create({
      data: {
        orgId: body.orgId ?? "org-default",
        clientId: body.clientId,
        claimType: body.claimType,
        status: body.status ?? "DRAFT",
        claimNumber: body.claimNumber,
        currency: body.currency ?? "ZAR",
        submittedAmountMinor: body.submittedAmountMinor ?? 0,
        approvedAmountMinor: body.approvedAmountMinor ?? 0,
        paidAmountMinor: body.paidAmountMinor ?? 0,
        submissionPayload: body.submissionPayload,
        responsePayload: body.responsePayload,
        notes: body.notes,
        submittedAt: body.submittedAt ? new Date(body.submittedAt) : undefined,
        decidedAt: body.decidedAt ? new Date(body.decidedAt) : undefined,
        paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
      },
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create claim.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}