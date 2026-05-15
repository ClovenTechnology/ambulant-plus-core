import { NextRequest } from "next/server";
import { proxyToGatewayWithRbac } from "@/src/lib/gateway-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToGatewayWithRbac(req, "/org", "/api/org/structure");
}