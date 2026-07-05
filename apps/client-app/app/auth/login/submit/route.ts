import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_APIGW_BASE = "https://api-gateway.ambulantplus.co.za";

function apigwBase(req: NextRequest) {
  const raw = String(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      CANONICAL_APIGW_BASE,
  ).trim();

  const candidate = raw.replace(/\/+$/, "") || CANONICAL_APIGW_BASE;
  const currentHost = new URL(req.url).host.toLowerCase();

  try {
    const parsed = new URL(candidate);
    const host = parsed.host.toLowerCase();

    if (
      host === currentHost ||
      host.includes("clients.ambulantplus.co.za") ||
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1")
    ) {
      return CANONICAL_APIGW_BASE;
    }

    return candidate;
  } catch {
    return CANONICAL_APIGW_BASE;
  }
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

    const res = await fetch(`${apigwBase(req)}/api/client/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ambulant-source": "client-app-login",
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