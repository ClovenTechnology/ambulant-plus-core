import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canAccessClientPath } from "@/src/lib/client-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionPayload = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  workspace?: string | null;
  role?: string | null;
  scopes?: unknown;
};

function safeParseSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as SessionPayload) : null;
  } catch {
    return null;
  }
}

function gatewayBase() {
  const value = String(process.env.APIGW_BASE || "").trim();

  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 500;
    throw err;
  }

  return value.replace(/\/+$/, "");
}

function authHeaders(session: SessionPayload) {
  return {
    "content-type": "application/json",
    "x-ambulant-user-id": String(session.uid || session.email || ""),
    "x-ambulant-org-id": String(session.orgId || ""),
    "x-ambulant-role": String(session.role || "READ_ONLY"),
    "x-ambulant-workspace": String(session.workspace || "payer_ops"),
    "x-ambulant-trusted": "client-app-proxy",
  };
}

function requireExportsAccess(session: SessionPayload | null) {
  if (!session?.uid) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  if (!canAccessClientPath(session, "/exports")) {
    return NextResponse.json({ ok: false, error: "forbidden_scheme_adapters" }, { status: 403 });
  }

  return null;
}

export async function GET(req: NextRequest) {
  const session = safeParseSession(cookies().get("ambulant_client_session")?.value);
  const blocked = requireExportsAccess(session);
  if (blocked) return blocked;

  const activeSession = session as SessionPayload;

  const incoming = new URL(req.url);
  const target = new URL(`${gatewayBase()}/api/scheme-adapters`);

  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const res = await fetch(target.toString(), {
    method: "GET",
    headers: authHeaders(activeSession),
    cache: "no-store",
  });

  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const session = safeParseSession(cookies().get("ambulant_client_session")?.value);
  const blocked = requireExportsAccess(session);
  if (blocked) return blocked;

  const activeSession = session as SessionPayload;

  const body = await req.text();

  const res = await fetch(`${gatewayBase()}/api/scheme-adapters`, {
    method: "POST",
    headers: authHeaders(activeSession),
    body,
    cache: "no-store",
  });

  const responseText = await res.text();

  return new NextResponse(responseText, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}