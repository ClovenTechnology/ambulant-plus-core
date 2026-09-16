import { withPartnerRoute } from '@/lib/partner-route';
// apps/medreach/app/api/lab-networks/route.ts
import { NextRequest } from 'next/server';
import { proxyGateway } from './_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-networks', 'GET');
}

async function partnerOriginalPOST(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-networks', 'POST');
}
export const GET = withPartnerRoute(partnerOriginalGET);
export const POST = withPartnerRoute(partnerOriginalPOST);
