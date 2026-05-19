import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createCoverageAuthorization } from "@ambulant/client-core/src/authorizations";
import { requireApiClientRole } from "@/src/lib/client-rbac";
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from "@/src/lib/identity";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") ?? who.orgId ?? "org-default";
    const clientId = searchParams.get("clientId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const rawItems = await prisma.coverageAuthorization.findMany({
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
        coveragePlan: {
          select: {
            id: true,
            name: true,
            status: true,
            currency: true,
            metadata: true,
          },
        },
        clientMember: {
          select: {
            id: true,
            patientId: true,
            userId: true,
            memberNumber: true,
            employeeNumber: true,
            dependentCode: true,
            principalMemberNumber: true,
            memberKind: true,
            memberStatus: true,
            coveragePlanId: true,
            metadata: true,
          },
        },
      },
      orderBy: [{ requestedAt: "desc" }],
      take: 100,
    });

    const items = rawItems.map((item) => {
      const member = item.clientMember;
      const plan = item.coveragePlan;
      const client = item.client;
      const memberMetadata = (member?.metadata || {}) as Record<string, any>;

      return {
        ...item,

        memberNumber: member?.memberNumber ?? null,
        membershipNumber: member?.memberNumber ?? null,
        employeeNumber: member?.employeeNumber ?? null,
        dependentCode: member?.dependentCode ?? null,
        principalMemberNumber: member?.principalMemberNumber ?? null,
        memberStatus: member?.memberStatus ?? null,
        memberKind: member?.memberKind ?? null,

        coveragePlanName: plan?.name ?? null,
        coveragePlanStatus: plan?.status ?? null,

        clientName: client?.tradingName || client?.legalName || null,
        clientType: client?.type ?? null,

        healthContext: memberMetadata.healthContext ?? null,
        rewardProfile: memberMetadata.rewardProfile ?? null,
        iomtSharing: memberMetadata.iomtSharing ?? null,
        gymMembership: memberMetadata.gymMembership ?? null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch authorizations.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "CARE_COORDINATOR"]
    );

    if (auth.ok === false) {
      return auth.response;
    }

    const body = await req.json();
    const idempotencyKey = req.headers.get("x-idempotency-key");

    const item = await createCoverageAuthorization({
      ...body,
      orgId: body?.orgId ?? who.orgId ?? "org-default",
      userId: body?.userId ?? who.uid ?? undefined,
      idempotencyKey,
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create authorization.";

    const status =
      message === "Unauthorized"
        ? 401
        : message === "idempotency_key_reused_with_different_payload"
          ? 409
          : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}