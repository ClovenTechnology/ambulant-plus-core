import { NextRequest, NextResponse } from "next/server";
import { scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/src/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeWorkspace(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "WELLNESS_PARTNER" || raw === "GYM") return "wellness_partner";
  if (raw === "CORPORATE_SPONSOR") return "corporate_sponsor";
  return "payer_ops";
}

function landingPathForWorkspace(workspace: string) {
  return workspace === "wellness_partner" ? "/wellness" : "/dashboard";
}

async function ensureCredentialTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ClientOrgUserCredential" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "passwordSetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClientOrgUserCredential_orgId_email_key" UNIQUE ("orgId", "email")
    )
  `);
}

function verifyPassword(password: string, stored: string) {
  const parts = String(stored || "").split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = Buffer.from(parts[5], "hex");

  if (!n || !r || !p || !salt || expected.length === 0) {
    return false;
  }

  const actual = scryptSync(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function sessionForUser(user: any) {
  const workspace = normalizeWorkspace(user.defaultWorkspace);

  return {
    uid: user.userId || user.email,
    orgId: user.orgId,
    email: user.email,
    orgType: String(user.org?.orgType || "MEDICAL_AID"),
    workspace,
    role: user.role,
    scopes: Array.isArray(user.scopes) ? user.scopes : [],
    orgName: user.org?.name || null,
    orgStatus: user.org?.status || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ ok: false, error: "password_required" }, { status: 400 });
    }

    await ensureCredentialTable();

    const binding = await prisma.clientOrgUser.findFirst({
      where: {
        email,
        status: "ACTIVE" as any,
      },
      include: {
        org: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!binding || binding.org?.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "active_organization_access_not_found" },
        { status: 403 },
      );
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ passwordHash: string }>>(
      `
        SELECT "passwordHash"
        FROM "ClientOrgUserCredential"
        WHERE "orgId" = $1 AND lower("email") = lower($2)
        LIMIT 1
      `,
      binding.orgId,
      email,
    );

    const passwordHash = rows[0]?.passwordHash;

    if (!passwordHash) {
      return NextResponse.json(
        { ok: false, error: "password_not_set_accept_latest_invite" },
        { status: 403 },
      );
    }

    if (!verifyPassword(password, passwordHash)) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    const session = sessionForUser(binding);
    const redirectTo = landingPathForWorkspace(session.workspace);

    return NextResponse.json({
      ok: true,
      redirectTo,
      session,
      user: {
        id: binding.id,
        email: binding.email,
        name: binding.name,
        role: binding.role,
        status: binding.status,
        orgId: binding.orgId,
      },
      org: {
        id: binding.org.id,
        name: binding.org.name,
        orgType: binding.org.orgType,
        status: binding.org.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "client_login_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}