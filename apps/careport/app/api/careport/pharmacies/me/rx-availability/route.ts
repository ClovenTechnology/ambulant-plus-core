import { NextRequest } from "next/server";
import { proxyRx } from "@/app/api/careport/pharmacies/me/rx/_proxy";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(req: NextRequest){return proxyRx(req,"/api/careport/pharmacies/me/rx-availability","GET");}
export async function PATCH(req: NextRequest){return proxyRx(req,"/api/careport/pharmacies/me/rx-availability","PATCH");}
