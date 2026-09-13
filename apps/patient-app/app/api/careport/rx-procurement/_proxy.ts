import { NextRequest, NextResponse } from "next/server";
import {
  forwardAuthHeaders,
  forwardJsonHeaders,
  gatewayNotConfigured,
  getGatewayBase,
  readJsonResponse,
} from "@/app/api/careport/_gw";

export async function proxyCarePortRx(
  req: NextRequest,
  upstreamPath: string,
  method: "GET" | "POST" | "PATCH",
) {
  const gatewayBase = getGatewayBase();
  if (!gatewayBase) return gatewayNotConfigured("careport_rx");

  const incoming = new URL(req.url);
  const upstream = new URL(upstreamPath, gatewayBase);
  incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  try {
    const body = method === "GET" ? undefined : await req.text();
    const res = await fetch(upstream.toString(), {
      method,
      headers: method === "GET" ? forwardAuthHeaders(req) : forwardJsonHeaders(req),
      ...(body !== undefined ? { body } : {}),
      cache: "no-store",
    });

    return NextResponse.json(await readJsonResponse(res), {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "careport_rx_proxy_failed" },
      { status: 502 },
    );
  }
}
