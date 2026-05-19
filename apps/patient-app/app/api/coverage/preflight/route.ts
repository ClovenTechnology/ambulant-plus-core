import { NextRequest, NextResponse } from "next/server";
import { getGatewayBase, forwardAuthHeaders } from "@/app/api/careport/_gw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const upstream = new URL("/api/coverage/preflight", getGatewayBase());

    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: forwardAuthHeaders(req),
      body,
      cache: "no-store"
    });

    const text = await r.text().catch(() => "");

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Coverage preflight failed.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}