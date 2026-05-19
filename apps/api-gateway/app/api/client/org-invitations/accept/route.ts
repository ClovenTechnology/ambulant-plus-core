import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const body = await req.json().catch(() => ({}));

    const token = String(body.token || "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 });
    }

    const userId = String(body.userId || who.uid || body.email || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
    }

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
          name: body.name || invite.name,
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
          name: body.name || invite.name,
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

      return user;
    });

    return NextResponse.json({
      ok: true,
      user: accepted,
      org: {
        id: invite.org.id,
        name: invite.org.name,
        orgType: invite.org.orgType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invite_accept_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}