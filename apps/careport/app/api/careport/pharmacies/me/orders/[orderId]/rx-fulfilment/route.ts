import { withPartnerRoute } from '@/lib/partner-route';
import { NextRequest } from "next/server";
import { proxyRx } from "@/app/api/careport/pharmacies/me/rx/_proxy";
export const runtime="nodejs"; export const dynamic="force-dynamic";
async function partnerOriginalPOST(req: NextRequest, {params}: {params:{orderId:string}}){return proxyRx(req,`/api/careport/pharmacies/me/orders/${encodeURIComponent(params.orderId)}/rx-fulfilment`,"POST");}

export const POST = withPartnerRoute(partnerOriginalPOST);
