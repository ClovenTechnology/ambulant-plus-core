import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeWorkspace(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "WELLNESS_PARTNER" || raw === "GYM") return "wellness_partner";
  if (raw === "CORPORATE_SPONSOR") return "corporate_sponsor";
  return "payer_ops";
}

function landingPathForWorkspace(workspace: string) {
  return workspace === "wellness_partner" ? "/wellness" : "/dashboard";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ ok: false, error: "Password is required." }, { status: 400 });
    }

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

    if (!binding) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active organization access was found for this email. Please ask your organization admin to invite you.",
        },
        { status: 403 }
      );
    }

    const workspace = normalizeWorkspace((binding as any).defaultWorkspace);
    const redirectTo = landingPathForWorkspace(workspace);

    const session = {
      uid: binding.userId || email,
      orgId: binding.orgId,
      email,
      orgType: String((binding as any).org?.orgType || "MEDICAL_AID"),
      workspace,
      role: binding.role,
      scopes: Array.isArray(binding.scopes) ? binding.scopes : [],
      orgName: (binding as any).org?.name || null,
      orgStatus: (binding as any).org?.status || null,
    };

    const res = NextResponse.json({
      ok: true,
      redirectTo,
      session,
    });

    res.cookies.set("ambulant_client_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}