// FILE: apps/patient-app/app/api/careport/orders/[orderId]/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { forwardAuthHeaders, getGatewayBase } from "@/app/api/careport/_gw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const orderId = String(params.orderId || "").trim();
  if (!orderId) return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const base = getGatewayBase();
  const upstream = new URL(`/api/careport/orders/${encodeURIComponent(orderId)}/checkout`, base);

  const r = await fetch(upstream.toString(), {
    method: "POST",
    headers: { ...Object.fromEntries(forwardAuthHeaders(req)), "content-type": "application/json" } as any,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const js = await r.json().catch(() => ({}));
  return NextResponse.json(js, { status: r.status });
}