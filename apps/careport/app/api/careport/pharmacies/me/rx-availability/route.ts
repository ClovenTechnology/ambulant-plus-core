import { withPartnerRoute } from '@/lib/partner-route';
import { NextRequest } from "next/server";
import { proxyRx } from "@/app/api/careport/pharmacies/me/rx/_proxy";
export const runtime="nodejs"; export const dynamic="force-dynamic";
async function partnerOriginalGET(req: NextRequest){return proxyRx(req,"/api/careport/pharmacies/me/rx-availability","GET");}
async function partnerOriginalPATCH(req: NextRequest){return proxyRx(req,"/api/careport/pharmacies/me/rx-availability","PATCH");}

export const GET = withPartnerRoute(partnerOriginalGET);
export const PATCH = withPartnerRoute(partnerOriginalPATCH);
