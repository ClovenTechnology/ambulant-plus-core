import { NextRequest } from "next/server";
import { proxyRxStream } from "@/app/api/careport/pharmacies/me/rx/_proxy";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(req: NextRequest){return proxyRxStream(req,"/api/careport/pharmacies/me/rx-events/stream");}
