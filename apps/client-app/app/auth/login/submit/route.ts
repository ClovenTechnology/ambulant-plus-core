import { NextRequest, NextResponse } from "next/server";
import { clientApigwOrigin, errorMessage } from "../../_gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const target = `${clientApigwOrigin(req.url)}/api/client/auth/login`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ambulant-source": "client-app-auth-login-submit",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok || !json?.session) {
      return NextResponse.json(
        {
          ok: false,
          error: errorMessage(json?.error, "Login failed."),
        },
        { status: res.status || 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: json.redirectTo || "/dashboard",
      session: json.session,
    });

    response.cookies.set("ambulant_client_session", JSON.stringify(json.session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}