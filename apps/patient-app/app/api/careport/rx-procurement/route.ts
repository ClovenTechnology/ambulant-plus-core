import { NextRequest } from "next/server";
import { proxyCarePortRx } from "@/app/api/careport/rx-procurement/_proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return proxyCarePortRx(req, "/api/careport/rx-procurement", "GET"); }
export async function POST(req: NextRequest) { return proxyCarePortRx(req, "/api/careport/rx-procurement", "POST"); }
