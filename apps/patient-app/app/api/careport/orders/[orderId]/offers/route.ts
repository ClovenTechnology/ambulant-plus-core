// FILE: apps/patient-app/app/api/careport/orders/[orderId]/offers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { forwardAuthHeaders, getGatewayBase } from "@/app/api/careport/_gw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const orderId = String(params.orderId || "").trim();
  if (!orderId) return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });

  const base = getGatewayBase();
  const upstream = new URL(`/api/careport/orders/${encodeURIComponent(orderId)}/offers`, base);

  const r = await fetch(upstream.toString(), {
    method: "GET",
    headers: forwardAuthHeaders(req),
    cache: "no-store",
  });

  const js = await r.json().catch(() => ({}));
  return NextResponse.json(js, { status: r.status });
}