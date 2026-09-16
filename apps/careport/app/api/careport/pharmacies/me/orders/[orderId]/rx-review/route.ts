import { withPartnerRoute } from '@/lib/partner-route';
import { NextRequest } from "next/server";
import { proxyRx } from "@/app/api/careport/pharmacies/me/rx/_proxy";
export const runtime="nodejs"; export const dynamic="force-dynamic";
async function partnerOriginalGET(req: NextRequest, {params}: {params:{orderId:string}}){return proxyRx(req,`/api/careport/pharmacies/me/orders/${encodeURIComponent(params.orderId)}/rx-review`,"GET");}
async function partnerOriginalPOST(req: NextRequest, {params}: {params:{orderId:string}}){return proxyRx(req,`/api/careport/pharmacies/me/orders/${encodeURIComponent(params.orderId)}/rx-review`,"POST");}

export const GET = withPartnerRoute(partnerOriginalGET);
export const POST = withPartnerRoute(partnerOriginalPOST);
