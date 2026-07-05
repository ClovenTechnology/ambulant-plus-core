import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ClientProxySession = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  workspace?: string | null;
  role?: string | null;
  clientId?: string | null;
};

function requiredApiBase() {
  const value = String(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      "",
  )
    .trim()
    .replace(/\/+$/, "");

  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  return value;
}

function readSessionCookie(req: NextRequest): ClientProxySession | null {
  const raw =
    req.cookies.get("ambulant_client_session")?.value ||
    req.cookies.get("ambulant:client-session")?.value ||
    req.cookies.get("client_session")?.value ||
    "";

  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function sessionIdentity(session: ClientProxySession | null) {
  return {
    userId: String(session?.uid || session?.email || "").trim(),
    orgId: String(session?.orgId || "").trim(),
    clientId: String(session?.clientId || "").trim(),
  };
}

function trustedHeaders(
  session: ClientProxySession,
  identity: { userId: string; orgId: string; clientId?: string },
) {
  const h = new Headers();

  h.set("accept", "application/json");
  h.set("content-type", "application/json");
  h.set("x-ambulant-trusted", "client-app-proxy");
  h.set("x-ambulant-user-id", identity.userId);
  h.set("x-ambulant-org-id", identity.orgId);
  h.set("x-ambulant-workspace", String(session.workspace || "payer_ops"));
  h.set("x-ambulant-role", String(session.role || "ORG_OWNER"));

  if (identity.clientId) {
    h.set("x-ambulant-client-id", identity.clientId);
  }

  return h;
}

async function readJsonBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function proxy(req: NextRequest, method: "GET" | "PATCH") {
  try {
    const session = readSessionCookie(req);
    const identity = sessionIdentity(session);

    if (!identity.userId) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    if (!identity.orgId) {
      return NextResponse.json({ ok: false, error: "client_org_context_required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const body = method === "GET" ? null : await readJsonBody(req);

    const clientId = String(
      url.searchParams.get("clientId") ||
        (body && typeof body === "object" ? (body as any).clientId : "") ||
        identity.clientId ||
        "",
    ).trim();

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "client_context_required" }, { status: 400 });
    }

    const target = new URL("/api/member-reimbursement-claims", requiredApiBase());

    for (const [k, v] of url.searchParams.entries()) {
      target.searchParams.set(k, v);
    }

    target.searchParams.set("orgId", identity.orgId);
    target.searchParams.set("clientId", clientId);

    const init: RequestInit = {
      method,
      headers: trustedHeaders(session as ClientProxySession, {
        ...identity,
        clientId,
      }),
      cache: "no-store",
    };

    if (method !== "GET") {
      init.body = JSON.stringify(body || {});
    }

    const res = await fetch(target.toString(), init);
    const payload = await res.json().catch(() => ({}));

    return NextResponse.json(payload, { status: res.status });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 502;

    return NextResponse.json(
      { ok: false, error: e?.message || "member_reimbursement_proxy_failed" },
      { status },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}

export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}
