import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ENDPOINTS = new Set([
  "vendors",
  "expenditure",
  "vendor-invoices",
  "vendor-payouts",
  "inventory-categories",
  "inventory-items",
  "import-orders",
]);

const ALLOWED_METHODS = new Set(["POST", "PATCH"]);

function apiBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

function cleanEndpoint(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function idempotencyKey(value: unknown) {
  const provided = String(value || "").trim();
  if (provided) return provided.slice(0, 180);

  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "admin-procurement-" + Date.now().toString(36);
}

export async function POST(req: NextRequest) {
  const base = apiBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: "api_gateway_base_url_not_configured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const endpoint = cleanEndpoint(body.endpoint);
  const method = String(body.method || "POST").trim().toUpperCase();
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const key = idempotencyKey(body.idempotencyKey);

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_enterprise_finance_proxy_endpoint", endpoint },
      { status: 400 }
    );
  }

  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_enterprise_finance_proxy_method", method },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Idempotency-Key": key,
  };

  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");

  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;

  const response = await fetch(base + "/api/enterprise-finance/" + endpoint, {
    method,
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();

  return new NextResponse(text || JSON.stringify({ ok: response.ok }), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
      "x-enterprise-finance-proxy": "procurement-action-console",
      "x-idempotency-key": key,
    },
  });
}
