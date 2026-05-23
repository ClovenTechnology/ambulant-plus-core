import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimSlash(s: string) {
  return String(s || "").replace(/\/+$/, "");
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      'https://ambulant-plus-core-api-gateway-kdon.vercel.app',
  );
}

function forwardPatientHeaders(req: NextRequest) {
  const headers = new Headers();

  ["cookie", "authorization", "x-ambulant-identity", "x-uid", "x-org-id"].forEach((k) => {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  });

  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  headers.set("x-role", "patient");

  return headers;
}

async function proxy(req: NextRequest, method: "GET" | "POST" | "PATCH") {
  const url = new URL(req.url);
  const target = `${gatewayBase()}/api/member-reimbursement-claims${url.search}`;

  const init: RequestInit = {
    method,
    headers: forwardPatientHeaders(req),
    cache: "no-store",
  };

  if (method !== "GET") {
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }

  try {
    const res = await fetch(target, init);
    const data = await res.json().catch(() => ({}));

    return NextResponse.json(
      data?.ok === false ? data : data,
      { status: res.status },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "member_reimbursement_proxy_failed",
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}

export async function POST(req: NextRequest) {
  return proxy(req, "POST");
}

export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}