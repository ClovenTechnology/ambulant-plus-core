import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_APIGW_BASE = "https://api-gateway.ambulantplus.co.za";

function apigwBase() {
  const value = String(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      CANONICAL_APIGW_BASE,
  ).trim();

  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  const normalised = value.replace(/\/+$/, "");

  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalised)) {
    const err = new Error("APIGW_BASE_must_not_be_localhost") as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  return normalised;
}

function safeJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = `${apigwBase()}/api/client/orgs/request-access`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "x-ambulant-source": "client-app-request-access",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    const json = safeJson(text);

    if (json) {
      return NextResponse.json(json, {
        status: res.status,
        headers: { "cache-control": "no-store" },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "upstream_response_invalid",
        upstreamStatus: res.status,
        upstreamContentType: contentType,
        upstreamBodyPreview: text.slice(0, 600),
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