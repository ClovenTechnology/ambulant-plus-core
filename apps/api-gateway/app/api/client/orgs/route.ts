import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";

function workspaceForOrgType(orgType: string) {
  if (orgType === "GYM" || orgType === "WELLNESS_PARTNER") return "WELLNESS_PARTNER";
  if (orgType === "CORPORATE_SPONSOR") return "CORPORATE_SPONSOR";
  return "PAYER_OPS";
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = who.orgId || req.nextUrl.searchParams.get("orgId");

  const items = await prisma.clientOrg.findMany({
    where: orgId ? { id: orgId } : undefined,
    include: {
      workspaces: true,
      users: true,
      apiClients: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    const legalName = String(body.legalName || name).trim();
    const orgType = String(body.orgType || "").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    }

    if (!orgType) {
      return NextResponse.json({ ok: false, error: "orgType_required" }, { status: 400 });
    }

    const ownerEmail = String(body.ownerEmail || body.email || "").trim().toLowerCase();
    if (!ownerEmail) {
      return NextResponse.json({ ok: false, error: "ownerEmail_required" }, { status: 400 });
    }

    const workspace = workspaceForOrgType(orgType);
    const ownerUserId = String(body.ownerUserId || who.uid || ownerEmail);

    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.clientOrg.create({
        data: {
          name,
          legalName,
          orgType: orgType as any,
          registrationNo: body.registrationNo || null,
          taxNo: body.taxNo || null,
          country: String(body.country || "ZA").toUpperCase(),
          region: body.region || null,
          currency: String(body.currency || "ZAR").toUpperCase(),
          timezone: body.timezone || "Africa/Johannesburg",
          complianceProfile: body.complianceProfile || "ZA_STANDARD",
          status: "PENDING_REVIEW",
          metadata: {
            source: "client_org_onboarding",
            createdByUserId: who.uid || null,
            externalReference: body.externalReference || null,
          },
        },
      });

      await tx.clientOrgWorkspace.create({
        data: {
          orgId: org.id,
          workspace: workspace as any,
          active: true,
        },
      });

      await tx.clientOrgUser.create({
        data: {
          orgId: org.id,
          userId: ownerUserId,
          email: ownerEmail,
          name: body.ownerName || null,
          status: "ACTIVE",
          defaultWorkspace: workspace as any,
          role: "ORG_OWNER",
          scopes: [
            "org.users.manage",
            "org.roles.manage",
            "members.read",
            "coverage.read",
            "coverage.write",
            "authorizations.read",
            "claims.read",
            "rewards.read",
            "wellness.read",
          ],
          invitedByUserId: who.uid || null,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      return tx.clientOrg.findUnique({
        where: { id: org.id },
        include: {
          workspaces: true,
          users: true,
        },
      });
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "client_org_create_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}