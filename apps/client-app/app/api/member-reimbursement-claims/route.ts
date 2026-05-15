import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || "org-default";
const DEFAULT_CLIENT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_CLIENT_ID || "client-demo-medical-aid";

function trimSlash(value: string) {
  return String(value || "").replace(/\/+$/, "");
}

function apiBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      "http://localhost:3010",
  );
}

function readSessionCookie(req: NextRequest) {
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

function trustedHeaders(req: NextRequest) {
  const session = readSessionCookie(req);

  const h = new Headers();
  h.set("accept", "application/json");
  h.set("content-type", "application/json");
  h.set("x-ambulant-trusted", "client-app-proxy");
  h.set("x-ambulant-org-id", session?.orgId || req.headers.get("x-ambulant-org-id") || DEFAULT_ORG_ID);
  h.set("x-ambulant-workspace", session?.workspace || req.headers.get("x-ambulant-workspace") || "payer_ops");
  h.set("x-ambulant-role", session?.role || req.headers.get("x-ambulant-role") || "ORG_OWNER");
  h.set(
    "x-ambulant-user-id",
    session?.uid ||
      session?.email ||
      req.headers.get("x-ambulant-user-id") ||
      "admin@medicalaid.demo",
  );

  return h;
}

async function proxy(req: NextRequest, method: "GET" | "PATCH") {
  const url = new URL(req.url);
  const target = new URL("/api/member-reimbursement-claims", apiBase());

  for (const [k, v] of url.searchParams.entries()) target.searchParams.set(k, v);

  if (!target.searchParams.get("orgId")) target.searchParams.set("orgId", DEFAULT_ORG_ID);
  if (!target.searchParams.get("clientId")) target.searchParams.set("clientId", DEFAULT_CLIENT_ID);

  const init: RequestInit = {
    method,
    headers: trustedHeaders(req),
    cache: "no-store",
  };

  if (method !== "GET") {
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }

  try {
    const res = await fetch(target.toString(), init);
    const payload = await res.json().catch(() => ({}));

    return NextResponse.json(payload, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "member_reimbursement_proxy_failed" },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}

export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}