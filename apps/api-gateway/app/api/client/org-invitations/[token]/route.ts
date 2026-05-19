import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(
  _: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = String(params.token || "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "token_required" },
        { status: 400 }
      );
    }

    const invite = await prisma.clientOrgInvitation.findUnique({
      where: { token },
      include: { org: true },
    });

    if (!invite) {
      return NextResponse.json(
        { ok: false, error: "invitation_not_found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, invitation: invite });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "invitation_lookup_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}