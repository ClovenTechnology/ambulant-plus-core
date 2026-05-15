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

function apiBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    "http://localhost:3010"
  );
}

function readSession() {
  return safeParseSession(cookies().get("ambulant_client_session")?.value);
}

function authHeaders(session: ClientProxySession, req: NextRequest) {
  const headers: Record<string, string> = {
    "x-ambulant-user-id": String(session.uid || session.email || ""),
    "x-ambulant-org-id": String(session.orgId || "org-default"),
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
  const session = readSession();

  if (!session?.uid) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }

  if (!canAccessClientPath(session, clientPathForRbac)) {
    return NextResponse.json(
      { ok: false, error: "forbidden_client_proxy" },
      { status: 403 },
    );
  }

  const incoming = new URL(req.url);
  const target = new URL(`${apiBase()}${gatewayPath}`);

  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const hasBody = !["GET", "HEAD"].includes(req.method.toUpperCase());
  const body = hasBody ? await req.text() : undefined;

  const gatewayRes = await fetch(target.toString(), {
    method: req.method,
    headers: authHeaders(session, req),
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
}