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

function sessionIdentity(session: SessionPayload | null) {
  return {
    userId: String(session?.uid || session?.email || "").trim(),
    orgId: String(session?.orgId || "").trim(),
  };
}

function authHeaders(session: SessionPayload, identity: { userId: string; orgId: string }) {
  return {
    "x-ambulant-user-id": identity.userId,
    "x-ambulant-org-id": identity.orgId,
    "x-ambulant-role": String(session.role || "READ_ONLY"),
    "x-ambulant-workspace": String(session.workspace || "payer_ops"),
    "x-ambulant-trusted": "client-app-proxy",
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = safeParseSession(cookies().get("ambulant_client_session")?.value);
    const identity = sessionIdentity(session);

    if (!identity.userId) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    if (!identity.orgId) {
      return NextResponse.json({ ok: false, error: "client_org_context_required" }, { status: 403 });
    }

    if (!session || !canAccessClientPath(session, "/exports")) {
      return NextResponse.json({ ok: false, error: "forbidden_exports" }, { status: 403 });
    }

    const incoming = new URL(req.url);
    const target = new URL(`${requiredApiBase()}/api/client/exports`);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    target.searchParams.set("orgId", identity.orgId);

    const res = await fetch(target.toString(), {
      method: "GET",
      headers: authHeaders(session, identity),
      cache: "no-store",
    });

    const body = await res.arrayBuffer();
    const out = new NextResponse(body, { status: res.status });

    const contentType = res.headers.get("content-type");
    const contentDisposition = res.headers.get("content-disposition");
    const exportHash = res.headers.get("x-ambulant-export-hash");

    if (contentType) out.headers.set("content-type", contentType);
    if (contentDisposition) out.headers.set("content-disposition", contentDisposition);
    if (exportHash) out.headers.set("x-ambulant-export-hash", exportHash);

    out.headers.set("cache-control", "no-store");

    return out;
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 502;
    const message = error instanceof Error ? error.message : "client_exports_proxy_failed";

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
