import { NextRequest } from "next/server";
import { proxyCarePortRx } from "@/app/api/careport/rx-procurement/_proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  return proxyCarePortRx(req, `/api/careport/rx-procurement/${encodeURIComponent(params.sessionId)}`, "GET");
}
export async function PATCH(req: NextRequest, { params }: { params: { sessionId: string } }) {
  return proxyCarePortRx(req, `/api/careport/rx-procurement/${encodeURIComponent(params.sessionId)}`, "PATCH");
}
