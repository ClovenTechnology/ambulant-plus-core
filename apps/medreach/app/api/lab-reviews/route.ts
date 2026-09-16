import { withPartnerRoute } from '@/lib/partner-route';
// apps/medreach/app/api/lab-reviews/route.ts
import { NextRequest } from 'next/server';
import { proxyGateway } from '../lab-networks/_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-reviews', 'GET');
}

async function partnerOriginalPOST(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-reviews', 'POST');
}
export const GET = withPartnerRoute(partnerOriginalGET);
export const POST = withPartnerRoute(partnerOriginalPOST);
