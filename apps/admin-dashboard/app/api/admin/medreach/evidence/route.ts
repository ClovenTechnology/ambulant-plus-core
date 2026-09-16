import { withPartnerAdminProxy } from '@/lib/partner-admin-proxy';
// apps/admin-dashboard/app/api/admin/medreach/evidence/route.ts
import { NextRequest } from 'next/server';
import { proxyJson, readJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(req: NextRequest) {
  const url = new URL(req.url);

  return proxyJson(req, {
    method: 'GET',
    path: '/api/medreach/onboarding/evidence',
    search: url.search,
  });
}

async function partnerOriginalPATCH(req: NextRequest) {
  const body = await readJson(req);

  return proxyJson(req, {
    method: 'PATCH',
    path: '/api/medreach/onboarding/evidence',
    body,
  });
}

async function partnerOriginalPOST(req: NextRequest) {
  const body = await readJson(req);

  return proxyJson(req, {
    method: 'POST',
    path: '/api/medreach/onboarding/evidence',
    body,
  });
}
export const GET = withPartnerAdminProxy(partnerOriginalGET);
export const PATCH = withPartnerAdminProxy(partnerOriginalPATCH);
export const POST = withPartnerAdminProxy(partnerOriginalPOST);
