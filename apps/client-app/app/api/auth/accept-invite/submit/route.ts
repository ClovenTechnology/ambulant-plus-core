import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_APIGW_BASE = "https://api-gateway.ambulantplus.co.za";

function normaliseApigwBase(rawValue: unknown, currentHost?: string) {
  const raw = String(rawValue || CANONICAL_APIGW_BASE).trim() || CANONICAL_APIGW_BASE;

  try {
    const parsed = new URL(raw);
    const host = parsed.host.toLowerCase();
    const current = String(currentHost || "").toLowerCase();

    if (
      host === current ||
      host.includes("clients.ambulantplus.co.za") ||
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1")
    ) {
      return CANONICAL_APIGW_BASE;
    }

    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return CANONICAL_APIGW_BASE;
  }
}

function apigwBase(req: NextRequest) {
  return normaliseApigwBase(
    process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || CANONICAL_APIGW_BASE,
    new URL(req.url).host,
  );
}

function errorMessage(value: unknown, fallback: string) {
  if (!value) return fallback;
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    const record = value as Record<string, any>;
    return String(record.message || record.code || JSON.stringify(record));
  }

  return String(value);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const token = String(form.get("token") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const name = String(form.get("name") || "").trim();
  const password = String(form.get("password") || "").trim();

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_invite_token", req.url));
  }

  if (!password || password.length < 8) {
    return NextResponse.redirect(
      new URL(`/auth/accept-invite?token=${encodeURIComponent(token)}&error=password_minimum_8_characters`, req.url),
    );
  }

  try {
    const res = await fetch(`${apigwBase(req)}/api/client/org-invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ambulant-source": "client-app-accept-invite",
      },
      body: JSON.stringify({
        token,
        email,
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