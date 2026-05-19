// FILE: apps/patient-app/app/api/careport/orders/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { forwardAuthHeaders, getGatewayBase } from "@/app/api/careport/_gw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const encId = (url.searchParams.get("encId") || "").trim();
  if (!encId) return NextResponse.json({ ok: false, error: "encId_required" }, { status: 400 });

  const base = getGatewayBase();
  const upstream = new URL(`/api/careport/orders`, base);
  upstream.searchParams.set("encounterId", encId);
  upstream.searchParams.set("limit", "1");

  const r = await fetch(upstream.toString(), {
    method: "GET",
    headers: forwardAuthHeaders(req),
    cache: "no-store",
  });

  const js = await r.json().catch(() => ({}));
  if (!r.ok || !js?.ok) return NextResponse.json(js, { status: r.status });

  const order = Array.isArray(js.orders) ? js.orders[0] ?? null : null;
  return NextResponse.json({ ok: true, order }, { status: 200 });
}
