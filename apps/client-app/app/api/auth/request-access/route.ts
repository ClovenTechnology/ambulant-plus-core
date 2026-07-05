import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_APIGW_BASE = "https://api-gateway.ambulantplus.co.za";

function normaliseApigwBase(rawValue: unknown, currentHost?: string) {
  const raw = String(rawValue || CANONICAL_APIGW_BASE).trim() || CANONICAL_APIGW_BASE;

  try {
    const parsed = new URL(raw);
    const host = parsed.host.toLowerCase();
    const current = String(currentHost || "").toLowerCase();

    if (
      host === current ||
      host.includes("clients.ambulantplus.co.za") ||
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1")
    ) {
      return CANONICAL_APIGW_BASE;
    }

    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return CANONICAL_APIGW_BASE;
  }
}

function apigwBase(req: NextRequest) {
  return normaliseApigwBase(
    process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || CANONICAL_APIGW_BASE,
    new URL(req.url).host,
  );
}

function safeJson(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asErrorString(value: unknown, fallback: string) {
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
    const body = await req.json().catch(() => ({}));
    const target = `${apigwBase(req)}/api/client/orgs/request-access`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ambulant-source": "client-app-request-access",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    const json = safeJson(text);

    if (json?.ok) {
      return NextResponse.json(json, {
        status: res.status,
        headers: { "cache-control": "no-store" },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: asErrorString(json?.error, "upstream_request_access_failed"),
        upstreamStatus: res.status,
        upstreamContentType: contentType,
        upstreamBodyPreview: json ? undefined : text.slice(0, 600),
      },
      {
        status: res.status || 502,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "request_access_failed",
      },
      {
        status: error?.status || 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}