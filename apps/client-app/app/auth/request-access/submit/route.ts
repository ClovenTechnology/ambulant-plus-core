import { NextRequest, NextResponse } from "next/server";
import { clientApigwOrigin, errorMessage } from "../../_gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPayload(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return req.json().catch(() => ({}));
  }

  const form = await req.formData().catch(() => null);
  if (!form) return {};

  return Object.fromEntries(form.entries());
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readPayload(req);
    const target = `${clientApigwOrigin(req.url)}/api/client/orgs/request-access`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-ambulant-source": "client-app-auth-request-access-submit",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (json?.ok) {
      return NextResponse.json(json, {
        status: res.status,
        headers: { "cache-control": "no-store" },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(json?.error, "request_access_failed"),
        upstreamStatus: res.status,
        upstreamTarget: target,
        upstreamBodyPreview: json ? undefined : text.slice(0, 500),
      },
      {
        status: res.status || 502,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "request_access_failed",
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}