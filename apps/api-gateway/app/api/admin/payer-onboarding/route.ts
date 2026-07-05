import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = clean(searchParams.get("status"));
  const q = clean(searchParams.get("q")).toLowerCase();

  const items = await prisma.clientOrg.findMany({
    where: {
      orgType: { in: Array.from(PAYER_ORG_TYPES) as any[] },
      ...(status ? { status: status as any } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as any } },
              { legalName: { contains: q, mode: "insensitive" as any } },
            ],
          }
        : {}),
    },
    include: {
      workspaces: true,
      users: true,
      invitations: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    { ok: true, items },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const who = readIdentity(req.headers);
    const body = await req.json().catch(() => ({}));

    const name = clean(body.name || body.organizationName || body.schemeName);
    const legalName = clean(body.legalName || name);
    const ownerEmail = clean(body.ownerEmail || body.email).toLowerCase();
    const ownerName = clean(body.ownerName || body.contactName);
    const orgType = normalizeOrgType(body.orgType || body.type);
    const workspace = workspaceForOrgType(orgType);

    if (!name) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
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
          status: (body.activateNow ? "ACTIVE" : "PENDING_REVIEW") as any,
          registrationNo: clean(body.registrationNo) || null,
          taxNo: clean(body.taxNo) || null,
          country: clean(body.country || "ZA", 2).toUpperCase() || "ZA",
          region: clean(body.region) || null,
          currency: clean(body.currency || "ZAR", 3).toUpperCase() || "ZAR",
          timezone: clean(body.timezone || "Africa/Johannesburg") || "Africa/Johannesburg",
          complianceProfile: clean(body.complianceProfile || "ZA_STANDARD") || "ZA_STANDARD",
          metadata: {
            source: "admin_led_payer_onboarding",
            adminLed: true,
            createdByUserId: who.uid || null,
            contactName: ownerName || null,
            contactEmail: ownerEmail,
            contactPhone: clean(body.contactPhone || body.phone) || null,
            notes: clean(body.notes, 1000) || null,
            portalAccess: Boolean(body.activateNow),
            marketplaceVisible: Boolean(body.marketplaceVisible ?? false),
            allowPatientSelfLinking: Boolean(body.allowPatientSelfLinking ?? false),
            selfLinkVerificationMode: clean(body.selfLinkVerificationMode || "MANUAL_REVIEW"),
            allowPatientApplications: Boolean(body.allowPatientApplications ?? false),
            allowPlanApplications: Boolean(body.allowPlanApplications ?? false),
          },
        },
      });

      await tx.clientOrgWorkspace.create({
        data: {
          orgId: org.id,
          workspace: workspace as any,
          active: Boolean(body.activateNow),
          metadata: {
            source: "admin_led_payer_onboarding",
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
          invitedByUserId: who.uid || null,
          invitedAt: new Date(),
        },
      });

      return tx.clientOrg.findUnique({
        where: { id: org.id },
        include: {
          workspaces: true,
          users: true,
          invitations: true,
        },
      });
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payer_onboarding_create_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}