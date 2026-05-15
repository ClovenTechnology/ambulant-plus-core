import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const email = String(body?.email || "").trim();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Password reset request accepted.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process reset request.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}