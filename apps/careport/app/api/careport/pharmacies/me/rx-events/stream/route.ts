import { withPartnerRoute } from '@/lib/partner-route';
import { NextRequest } from "next/server";
import { proxyRxStream } from "@/app/api/careport/pharmacies/me/rx/_proxy";
export const runtime="nodejs"; export const dynamic="force-dynamic";
async function partnerOriginalGET(req: NextRequest){return proxyRxStream(req,"/api/careport/pharmacies/me/rx-events/stream");}

export const GET = withPartnerRoute(partnerOriginalGET);
