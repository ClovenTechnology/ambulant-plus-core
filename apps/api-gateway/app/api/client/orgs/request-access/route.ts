import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYER_ORG_TYPES = new Set([
  "MEDICAL_AID",
  "HMO",
  "CORPORATE_SPONSOR",
  "WELLNESS_PARTNER",
]);

function clean(value: unknown, max = 220) {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeOrgType(value: unknown) {
  const raw = clean(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (PAYER_ORG_TYPES.has(raw)) return raw;
  return "MEDICAL_AID";
}

function workspaceForOrgType(orgType: string) {
  if (orgType === "WELLNESS_PARTNER") return "WELLNESS_PARTNER";
  if (orgType === "CORPORATE_SPONSOR") return "CORPORATE_SPONSOR";
  return "PAYER_OPS";
}

function ownerScopesForWorkspace(workspace: string) {
  if (workspace === "WELLNESS_PARTNER") {
    return [
      "org.users.manage",
      "wellness.read",
      "wellness.write",
      "rewards.read",
      "rewards.write",
    ];
  }

  return [
    "org.users.manage",
    "org.roles.manage",
    "members.read",
    "members.write",
    "coverage.read",
    "coverage.write",
    "authorizations.read",
    "authorizations.write",
    "claims.read",
    "claims.write",
    "settlements.read",
    "provider-network.read",
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = clean(body.name || body.organizationName || body.schemeName);
    const legalName = clean(body.legalName || name);
    const ownerEmail = clean(body.ownerEmail || body.email).toLowerCase();
    const ownerName = clean(body.ownerName || body.contactName);
    const contactPhone = clean(body.contactPhone || body.phone);
    const country = clean(body.country || "ZA", 2).toUpperCase() || "ZA";
    const orgType = normalizeOrgType(body.orgType || body.type);
    const workspace = workspaceForOrgType(orgType);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "organization_name_required" },
        { status: 400 },
      );
    }

    if (!ownerEmail || !ownerEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "valid_owner_email_required" },
        { status: 400 },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.clientOrg.create({
        data: {
          name,
          legalName,
          orgType: orgType as any,
          status: "PENDING_REVIEW" as any,
          registrationNo: clean(body.registrationNo) || null,
          taxNo: clean(body.taxNo) || null,
          country,
          region: clean(body.region) || null,
          currency: clean(body.currency || "ZAR", 3).toUpperCase() || "ZAR",
          timezone: clean(body.timezone || "Africa/Johannesburg") || "Africa/Johannesburg",
          complianceProfile: clean(body.complianceProfile || "ZA_STANDARD") || "ZA_STANDARD",
          metadata: {
            source: "public_request_access",
            requestAccess: true,
            requestedAt: new Date().toISOString(),
            contactName: ownerName || null,
            contactEmail: ownerEmail,
            contactPhone: contactPhone || null,
            website: clean(body.website) || null,
            notes: clean(body.notes, 1000) || null,
            marketplaceRequested: Boolean(body.marketplaceRequested ?? true),
            integrationModeRequested: clean(body.integrationModeRequested || "PORTAL") || "PORTAL",
            approvalRequired: true,
            portalAccess: false,
          },
        },
      });

      await tx.clientOrgWorkspace.create({
        data: {
          orgId: org.id,
          workspace: workspace as any,
          active: false,
          metadata: {
            source: "public_request_access",
            activationRequired: true,
          },
        },
      });

      await tx.clientOrgUser.create({
        data: {
          orgId: org.id,
          userId: ownerEmail,
          email: ownerEmail,
          name: ownerName || null,
          status: "INVITED" as any,
          defaultWorkspace: workspace as any,
          role: "ORG_OWNER",
          scopes: ownerScopesForWorkspace(workspace),
          invitedAt: new Date(),
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

    return NextResponse.json(
      {
        ok: true,
        item: created,
        status: "PENDING_REVIEW",
        message:
          "Request received. Ambulant+ will review the organization before portal access is granted.",
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "payer_request_access_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}