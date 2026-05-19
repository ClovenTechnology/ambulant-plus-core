// apps/patient-app/app/api/careport/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { forwardAuthHeaders, getGatewayBase } from "@/app/api/careport/_gw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonSafe(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const gatewayBase = getGatewayBase();
  const upstream = new URL("/api/careport/orders", gatewayBase);

  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  try {
    const r = await fetch(upstream.toString(), {
      method: "GET",
      headers: forwardAuthHeaders(req),
      cache: "no-store"
    });

    const text = await r.text().catch(() => "");
    const data = parseJsonSafe(text);

    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read CarePort orders.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const gatewayBase = getGatewayBase();
  const upstream = new URL("/api/careport/orders", gatewayBase);

  try {
    const body = await req.text();

    const r = await fetch(upstream.toString(), {
      method: "PUT",
      headers: forwardAuthHeaders(req),
      body,
      cache: "no-store"
    });

    const text = await r.text().catch(() => "");
    const data = parseJsonSafe(text);

    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update CarePort order.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const gatewayBase = getGatewayBase();
  const upstream = new URL("/api/careport/orders", gatewayBase);

  try {
    const body = await req.text();

    const r = await fetch(upstream.toString(), {
      method: "POST",
      headers: forwardAuthHeaders(req),
      body,
      cache: "no-store"
    });

    const text = await r.text().catch(() => "");
    const data = parseJsonSafe(text);

    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create CarePort order action.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}