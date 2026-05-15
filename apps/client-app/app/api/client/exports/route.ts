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

function apiBase() {
  return process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || "http://localhost:3010";
}

function authHeaders(session: SessionPayload) {
  return {
    "x-ambulant-user-id": String(session.uid || session.email || ""),
    "x-ambulant-org-id": String(session.orgId || "org-default"),
    "x-ambulant-role": String(session.role || "READ_ONLY"),
    "x-ambulant-workspace": String(session.workspace || "payer_ops"),
    "x-ambulant-trusted": "client-app-proxy",
  };
}

export async function GET(req: NextRequest) {
  const session = safeParseSession(cookies().get("ambulant_client_session")?.value);

  if (!session?.uid) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  if (!canAccessClientPath(session, "/exports")) {
    return NextResponse.json({ ok: false, error: "forbidden_exports" }, { status: 403 });
  }

  const incoming = new URL(req.url);
  const target = new URL(`${apiBase()}/api/client/exports`);

  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  if (!target.searchParams.get("orgId")) {
    target.searchParams.set("orgId", session.orgId || "org-default");
  }

  const res = await fetch(target.toString(), {
    method: "GET",
    headers: authHeaders(session),
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
}