import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeWorkspace(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "WELLNESS_PARTNER" || raw === "GYM") return "wellness_partner";
  if (raw === "CORPORATE_SPONSOR") return "corporate_sponsor";
  return "payer_ops";
}

function redirectForWorkspace(workspace: string) {
  return workspace === "wellness_partner" ? "/wellness" : "/dashboard";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const token = String(form.get("token") || "").trim();
    const name = String(form.get("name") || "").trim();
    const password = String(form.get("password") || "").trim();

    if (!token) {
      return NextResponse.redirect(new URL("/auth/login?error=missing_invite_token", req.url));
    }

    if (!password) {
      return NextResponse.redirect(new URL(`/auth/accept-invite?token=${token}&error=password_required`, req.url));
    }

    const invite = await prisma.clientOrgInvitation.findUnique({
      where: { token },
      include: { org: true },
    });

    if (!invite || invite.status !== "INVITED" || invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid_invite", req.url));
    }

    const userId = invite.email;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.clientOrgUser.upsert({
        where: {
          orgId_email: {
            orgId: invite.orgId,
            email: invite.email,
          },
        },
        update: {
          userId,
          name: name || invite.name,
          status: "ACTIVE",
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
          status: "ACTIVE",
          defaultWorkspace: invite.defaultWorkspace,
          role: invite.role,
          scopes: invite.scopes,
          invitedByUserId: invite.invitedByUserId,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        },
      });

      await tx.clientOrgInvitation.update({
        where: { id: invite.id },
        data: {
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      return created;
    });

    const workspace = normalizeWorkspace(user.defaultWorkspace);
    const redirectTo = redirectForWorkspace(workspace);

    const session = {
      uid: user.userId || user.email,
      orgId: user.orgId,
      email: user.email,
      orgType: invite.org.orgType,
      workspace,
      role: user.role,
      scopes: user.scopes,
      orgName: invite.org.name,
      orgStatus: invite.org.status,
    };

    const res = NextResponse.redirect(new URL(redirectTo, req.url));

    res.cookies.set("ambulant_client_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=invite_accept_failed", req.url));
  }
}