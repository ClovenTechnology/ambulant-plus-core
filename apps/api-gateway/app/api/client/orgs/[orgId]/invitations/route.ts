import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/src/lib/db";
import { requireApiClientRole } from "@/src/lib/client-rbac";

const INVITE_ROLES = ["ORG_OWNER", "ORG_ADMIN"] as const;

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const auth = requireApiClientRole(req, [...INVITE_ROLES], { orgId: params.orgId });
  if (!auth.ok) return auth.response;

  const items = await prisma.clientOrgInvitation.findMany({
    where: { orgId: auth.actor.orgId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const auth = requireApiClientRole(req, [...INVITE_ROLES], { orgId: params.orgId });
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });

    const org = await prisma.clientOrg.findUnique({
      where: { id: auth.actor.orgId! },
      include: { workspaces: true },
    });
    if (!org) return NextResponse.json({ ok: false, error: "org_not_found" }, { status: 404 });

    const workspace = body.defaultWorkspace || org.workspaces[0]?.workspace || "PAYER_OPS";
    const token = crypto.randomBytes(24).toString("hex");
    const invite = await prisma.clientOrgInvitation.create({
      data: {
        orgId: org.id,
        email,
        name: body.name || null,
        token,
        role: body.role || "READ_ONLY_ANALYST",
        scopes: Array.isArray(body.scopes) ? body.scopes : [],
        defaultWorkspace: workspace as any,
        invitedByUserId: auth.actor.uid,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : defaultExpiry(),
      },
    });

    return NextResponse.json({
      ok: true,
      invitation: invite,
      inviteUrl: `/auth/accept-invite?token=${token}`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invite_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
