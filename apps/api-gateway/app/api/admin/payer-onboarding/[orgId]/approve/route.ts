import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_ADMIN",
  "PAYER_ONBOARDING_ADMIN",
]);

function clean(value: unknown, max = 220) {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function readRole(req: NextRequest) {
  const who = readIdentity(req.headers);
  const headerRole =
    req.headers.get("x-ambulant-role") ||
    req.headers.get("x-role") ||
    req.headers.get("x-admin-role") ||
    req.headers.get("x-user-role") ||
    "";
  return String(headerRole || who.role || "").trim().toUpperCase();
}

function requireAdmin(req: NextRequest) {
  const role = readRole(req);

  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json(
      { ok: false, error: "admin_role_required" },
      { status: 403 },
    );
  }

  return null;
}

function workspaceForOrgType(orgType: string) {
  if (orgType === "WELLNESS_PARTNER") return "WELLNESS_PARTNER";
  if (orgType === "CORPORATE_SPONSOR") return "CORPORATE_SPONSOR";
  return "PAYER_OPS";
}

function clientTypeForOrgType(orgType: string) {
  if (orgType === "CORPORATE_SPONSOR") return "CORPORATE_SPONSOR";
  if (orgType === "HMO") return "HMO";
  if (orgType === "WELLNESS_PARTNER") return "CORPORATE_SPONSOR";
  return "MEDICAL_AID";
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
    "client.exports.read",
  ];
}

function codeFromName(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);

  return base || `PAYER_${Date.now()}`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: { orgId: string } },
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const who = readIdentity(req.headers);
    const body = await req.json().catch(() => ({}));
    const orgId = clean(ctx.params.orgId);

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "org_id_required" }, { status: 400 });
    }

    const approved = await prisma.$transaction(async (tx) => {
      const org = await tx.clientOrg.findUnique({
        where: { id: orgId },
        include: {
          users: true,
          workspaces: true,
        },
      });

      if (!org) {
        throw new Error("client_org_not_found");
      }

      const orgType = String((org as any).orgType || "MEDICAL_AID");
      const workspace = workspaceForOrgType(orgType);
      const owner =
        org.users.find((u) => u.role === "ORG_OWNER") ||
        org.users[0];

      if (!owner?.email) {
        throw new Error("owner_email_required_before_approval");
      }

      const metadata =
        org.metadata && typeof org.metadata === "object"
          ? (org.metadata as Record<string, any>)
          : {};

      const nextOrg = await tx.clientOrg.update({
        where: { id: org.id },
        data: {
          status: "ACTIVE" as any,
          metadata: {
            ...metadata,
            approvedAt: new Date().toISOString(),
            approvedByUserId: who.uid || null,
            portalAccess: true,
            onboardingApproved: true,
          },
        },
      });

      await tx.clientOrgWorkspace.upsert({
        where: {
          orgId_workspace: {
            orgId: org.id,
            workspace: workspace as any,
          },
        },
        update: {
          active: true,
        },
        create: {
          orgId: org.id,
          workspace: workspace as any,
          active: true,
        },
      });

      const existingClient = await tx.client.findFirst({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
      });

      const clientData: Record<string, any> = {
        orgId: org.id,
        type: clientTypeForOrgType(orgType) as any,
        status: "ACTIVE" as any,
        legalName: org.legalName || org.name,
        tradingName: org.name,
        code: clean(body.clientCode || codeFromName(org.name)),
        billingMode: clean(body.billingMode || "HYBRID"),
        defaultCurrency: org.currency || "ZAR",
        country: org.country || "ZA",
        allowsClaims: Boolean(body.allowsClaims ?? true),
        allowsWalletFunding: Boolean(body.allowsWalletFunding ?? true),
        allowsHybridFunding: Boolean(body.allowsHybridFunding ?? true),
        paymentTermsDays: Number(body.paymentTermsDays || 30),
        contactEmail: owner.email,
        contactPhone: metadata.contactPhone || null,
        metadata: {
          source: "payer_onboarding_approval",
          clientOrgId: org.id,
          marketplaceVisible: Boolean(body.marketplaceVisible ?? metadata.marketplaceVisible ?? false),
          allowPatientSelfLinking: Boolean(body.allowPatientSelfLinking ?? metadata.allowPatientSelfLinking ?? false),
          selfLinkVerificationMode:
            clean(body.selfLinkVerificationMode || metadata.selfLinkVerificationMode || "MANUAL_REVIEW"),
          allowPatientApplications: Boolean(body.allowPatientApplications ?? metadata.allowPatientApplications ?? false),
          allowMarketplaceListing: Boolean(body.allowMarketplaceListing ?? metadata.allowMarketplaceListing ?? false),
          allowPlanApplications: Boolean(body.allowPlanApplications ?? metadata.allowPlanApplications ?? false),
        },
        payerMetadata: {
          orgType,
          integrationMode: clean(body.integrationMode || metadata.integrationModeRequested || "PORTAL"),
          approvedAt: new Date().toISOString(),
        },
      };

      const client = existingClient
        ? await tx.client.update({
            where: { id: existingClient.id },
            data: {
              ...clientData,
              code: existingClient.code || clientData.code,
            } as any,
          })
        : await tx.client.create({
            data: clientData as any,
          });

      const token = randomUUID();
      const invite = await tx.clientOrgInvitation.create({
        data: {
          orgId: org.id,
          email: owner.email,
          name: owner.name || null,
          token,
          status: "INVITED" as any,
          role: "ORG_OWNER",
          scopes: ownerScopesForWorkspace(workspace),
          defaultWorkspace: workspace as any,
          invitedByUserId: who.uid || null,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        },
      });

      return {
        org: nextOrg,
        client,
        invite,
      };
    });

    const clientBase =
      clean(process.env.CLIENT_APP_BASE_URL) ||
      clean(process.env.NEXT_PUBLIC_CLIENT_APP_BASE_URL) ||
      "https://clients.ambulantplus.co.za";

    const inviteUrl = `${clientBase.replace(/\/+$/, "")}/auth/accept-invite?token=${encodeURIComponent(
      approved.invite.token,
    )}`;

    return NextResponse.json(
      {
        ok: true,
        item: approved,
        inviteUrl,
        message: "Payer approved. First owner invitation has been created.",
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "payer_approval_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}