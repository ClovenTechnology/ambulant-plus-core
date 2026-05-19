// FILE: apps/api-gateway/app/api/careport/kyc/schemas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listSchemas } from "@/src/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = String(url.searchParams.get("country") || "ZA").toUpperCase() as any;
  return NextResponse.json({ ok: true, schemas: listSchemas(country) }, { status: 200 });
}