import { NextRequest, NextResponse } from "next/server";
import { clientApigwOrigin, errorMessage } from "../../_gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const token = String(form.get("token") || "").trim();
  const name = String(form.get("name") || "").trim();
  const password = String(form.get("password") || "").trim();
  const confirmPassword = String(form.get("confirmPassword") || "").trim();

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_invite_token", req.url));
  }

  if (!password || password.length < 8) {
    return NextResponse.redirect(
      new URL(`/auth/accept-invite?token=${encodeURIComponent(token)}&error=password_minimum_8_characters`, req.url),
    );
  }

  if (confirmPassword && confirmPassword !== password) {
    return NextResponse.redirect(
      new URL(`/auth/accept-invite?token=${encodeURIComponent(token)}&error=passwords_do_not_match`, req.url),
    );
  }

  try {
    const target = `${clientApigwOrigin(req.url)}/api/client/org-invitations/accept`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ambulant-source": "client-app-auth-accept-invite-complete",
      },
      body: JSON.stringify({
        token,
        name,
        password,
      }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok || !json?.session) {
      const msg = encodeURIComponent(errorMessage(json?.error, "invite_accept_failed"));
      return NextResponse.redirect(
        new URL(`/auth/accept-invite?token=${encodeURIComponent(token)}&error=${msg}`, req.url),
      );
    }

    const redirectTo = String(json.redirectTo || "/dashboard");
    const response = NextResponse.redirect(new URL(redirectTo, req.url));

    response.cookies.set("ambulant_client_session", JSON.stringify(json.session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "invite_accept_failed");
    return NextResponse.redirect(
      new URL(`/auth/accept-invite?token=${encodeURIComponent(token)}&error=${message}`, req.url),
    );
  }
}