import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canAccessClientPath } from "@/src/lib/client-rbac";

export type ClientProxySession = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  workspace?: string | null;
  role?: string | null;
  scopes?: unknown;
};

function safeParseSession(value: string | undefined): ClientProxySession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as ClientProxySession)
      : null;
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

function readSession() {
  return safeParseSession(cookies().get("ambulant_client_session")?.value);
}

function sessionIdentity(session: ClientProxySession | null) {
  return {
    userId: String(session?.uid || session?.email || "").trim(),
    orgId: String(session?.orgId || "").trim(),
  };
}

function authHeaders(
  session: ClientProxySession,
  req: NextRequest,
  identity: { userId: string; orgId: string },
) {
  const headers: Record<string, string> = {
    "x-ambulant-user-id": identity.userId,
    "x-ambulant-org-id": identity.orgId,
    "x-ambulant-role": String(session.role || "READ_ONLY"),
    "x-ambulant-workspace": String(session.workspace || "payer_ops"),
    "x-ambulant-trusted": "client-app-proxy",
  };

  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  return headers;
}

export async function proxyToGatewayWithRbac(
  req: NextRequest,
  clientPathForRbac: string,
  gatewayPath: string,
) {
  try {
    const session = readSession();
    const identity = sessionIdentity(session);

    if (!identity.userId) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 },
      );
    }

    if (!identity.orgId) {
      return NextResponse.json(
        { ok: false, error: "client_org_context_required" },
        { status: 403 },
      );
    }

    if (!session || !canAccessClientPath(session, clientPathForRbac)) {
      return NextResponse.json(
        { ok: false, error: "forbidden_client_proxy" },
        { status: 403 },
      );
    }

    const incoming = new URL(req.url);
    const target = new URL(`${requiredApiBase()}${gatewayPath}`);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    if (!target.searchParams.get("orgId")) {
      target.searchParams.set("orgId", identity.orgId);
    }

    const hasBody = !["GET", "HEAD"].includes(req.method.toUpperCase());
    const body = hasBody ? await req.text() : undefined;

    const gatewayRes = await fetch(target.toString(), {
      method: req.method,
      headers: authHeaders(session, req, identity),
      body,
      cache: "no-store",
    });

    const responseBody = await gatewayRes.arrayBuffer();

    const out = new NextResponse(responseBody, {
      status: gatewayRes.status,
    });

    const contentType = gatewayRes.headers.get("content-type");
    const contentDisposition = gatewayRes.headers.get("content-disposition");
    const exportHash = gatewayRes.headers.get("x-ambulant-export-hash");

    if (contentType) out.headers.set("content-type", contentType);
    if (contentDisposition) out.headers.set("content-disposition", contentDisposition);
    if (exportHash) out.headers.set("x-ambulant-export-hash", exportHash);

    out.headers.set("cache-control", "no-store");

    return out;
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 502;
    const message = error instanceof Error ? error.message : "client_gateway_proxy_failed";

    return NextResponse.json(
      { ok: false, error: message },
      { status },
    );
  }
}
