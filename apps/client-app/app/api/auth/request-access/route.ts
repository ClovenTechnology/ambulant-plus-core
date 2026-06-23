import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function apigwBase() {
  const value = String(process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || "").trim();

  if (!value) {
    const err = new Error("APIGW_BASE_required") as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  return value.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await fetch(`${apigwBase()}/api/client/orgs/request-access`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ambulant-source": "client-app-request-access",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    return NextResponse.json(json || { ok: false, error: "upstream_response_invalid" }, {
      status: res.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "request_access_failed" },
      { status: error?.status || 500 },
    );
  }
}