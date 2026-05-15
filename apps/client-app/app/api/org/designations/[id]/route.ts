import { NextRequest } from "next/server";
import { proxyToGatewayWithRbac } from "@/src/lib/gateway-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyToGatewayWithRbac(
    req,
    "/org",
    `/api/org/designations/${encodeURIComponent(params.id)}`,
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyToGatewayWithRbac(
    req,
    "/org",
    `/api/org/designations/${encodeURIComponent(params.id)}`,
  );
}