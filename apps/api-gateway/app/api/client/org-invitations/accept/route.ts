import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/src/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function normalizeWorkspace(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "WELLNESS_PARTNER" || raw === "GYM") return "wellness_partner";
  if (raw === "CORPORATE_SPONSOR") return "corporate_sponsor";
  return "payer_ops";
}

function landingPathForWorkspace(workspace: string) {
  return workspace === "wellness_partner" ? "/wellness" : "/dashboard";
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
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

function sessionForUser(user: any, org: any) {
  const workspace = normalizeWorkspace(user.defaultWorkspace);

  return {
    uid: user.userId || user.email,
    orgId: user.orgId,
    email: user.email,
    orgType: String(org?.orgType || "MEDICAL_AID"),
    workspace,
    role: user.role,
    scopes: Array.isArray(user.scopes) ? user.scopes : [],
    orgName: org?.name || null,
    orgStatus: org?.status || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const token = String(body.token || "").trim();
    const name = String(body.name || "").trim();
    const password = String(body.password || "").trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "password_minimum_8_characters" },
        { status: 400 },
      );
    }

    await ensureCredentialTable();

    const invite = await prisma.clientOrgInvitation.findUnique({
      where: { token },
      include: { org: true },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
    }

    if (invite.status !== "INVITED") {
      return NextResponse.json({ ok: false, error: "invitation_not_open" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: "invitation_expired" }, { status: 400 });
    }

    if (invite.org?.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: "organization_not_active" }, { status: 403 });
    }

    const userId = invite.email.toLowerCase();
    const passwordHash = hashPassword(password);

    const accepted = await prisma.$transaction(async (tx) => {
      const user = await tx.clientOrgUser.upsert({
        where: {
          orgId_email: {
            orgId: invite.orgId,
            email: invite.email,
          },
        },
        update: {
          userId,
          name: name || invite.name,
          status: "ACTIVE" as any,
          defaultWorkspace: invite.defaultWorkspace,
          role: invite.role,
          scopes: invite.scopes,
          acceptedAt: new Date(),
        },
        create: {
          orgId: invite.orgId,
          userId,
          email: invite.email,
          name: name || invite.name,
          status: "ACTIVE" as any,
          defaultWorkspace: invite.defaultWorkspace,
          role: invite.role,
          scopes: invite.scopes,
          invitedByUserId: invite.invitedByUserId,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        },
      });

      await tx.$executeRawUnsafe(
        `
          INSERT INTO "ClientOrgUserCredential"
            ("id", "orgId", "email", "passwordHash", "passwordSetAt", "createdAt", "updatedAt")
          VALUES
            ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("orgId", "email")
          DO UPDATE SET
            "passwordHash" = EXCLUDED."passwordHash",
            "passwordSetAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        `,
        randomUUID(),
        user.orgId,
        user.email.toLowerCase(),
        passwordHash,
      );

      await tx.clientOrgInvitation.update({
        where: { id: invite.id },
        data: {
          status: "ACTIVE" as any,
          acceptedAt: new Date(),
        },
      });

      return user;
    });

    const session = sessionForUser(accepted, invite.org);
    const redirectTo = landingPathForWorkspace(session.workspace);

    return NextResponse.json({
      ok: true,
      user: {
        id: accepted.id,
        email: accepted.email,
        name: accepted.name,
        role: accepted.role,
        status: accepted.status,
        orgId: accepted.orgId,
      },
      org: {
        id: invite.org.id,
        name: invite.org.name,
        orgType: invite.org.orgType,
        status: invite.org.status,
      },
      session,
      redirectTo,
      message: "Invitation accepted. Password has been set.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invite_accept_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}