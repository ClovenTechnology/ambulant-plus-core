import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientSession = {
  uid: string;
  orgId: string;
  email?: string;
  role?: string;
  workspace?: string;
};

function apigwBase() {
  const value = String(process.env.APIGW_BASE || "").trim();
  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  return value.replace(/\/+$/, "");
}

function parseSession(req: NextRequest): ClientSession | null {
  const raw = req.cookies.get("ambulant_client_session")?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const uid = String(parsed.uid || "").trim();
    const orgId = String(parsed.orgId || "").trim();
    if (!uid || !orgId) return null;

    return {
      uid,
      orgId,
      email: String(parsed.email || "").trim() || undefined,
      role: String(parsed.role || "").trim() || undefined,
      workspace: String(parsed.workspace || "").trim() || undefined,
    };
  } catch {
    return null;
  }
}

function headersFor(session: ClientSession, req: NextRequest) {
  const headers = new Headers();

  for (const key of ["authorization", "x-correlation-id", "x-request-id", "x-idempotency-key", "idempotency-key"]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  headers.set("x-ambulant-trusted", "client-app-proxy");
  headers.set("x-ambulant-user-id", session.uid);
  headers.set("x-ambulant-org-id", session.orgId);
  headers.set("x-ambulant-role", session.role || "READ_ONLY");
  headers.set("x-ambulant-workspace", session.workspace || "PAYER_OPS");

  return headers;
}

async function relay(res: Response) {
  const text = await res.text().catch(() => "");
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: text };
    }
  }

  return NextResponse.json(payload, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
}

async function proxy(req: NextRequest, ctx: { params: { gateway?: string[] } }) {
  try {
    const session = parseSession(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "client_session_required" }, { status: 401 });
    }

    const segments = ctx.params.gateway || [];
    const path = `/api/${segments.map(encodeURIComponent).join("/")}`;
    const target = new URL(`${apigwBase()}${path}`);

    const incoming = new URL(req.url);
    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    const existingOrg = String(target.searchParams.get("orgId") || "").trim();
    if (!existingOrg) target.searchParams.set("orgId", session.orgId);

    const init: RequestInit = {
      method: req.method,
      headers: headersFor(session, req),
      cache: "no-store",
    };

    if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      init.body = await req.text();
    }

    const res = await fetch(target.toString(), init);
    return relay(res);
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 502;
    const message = error instanceof Error ? error.message : "client_gateway_proxy_failed";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function GET(req: NextRequest, ctx: { params: { gateway?: string[] } }) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { gateway?: string[] } }) {
  return proxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: { gateway?: string[] } }) {
  return proxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: { gateway?: string[] } }) {
  return proxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: { gateway?: string[] } }) {
  return proxy(req, ctx);
}