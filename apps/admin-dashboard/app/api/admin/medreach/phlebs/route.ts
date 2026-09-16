import { withPartnerAdminProxy } from '@/lib/partner-admin-proxy';
// apps/admin-dashboard/app/api/admin/medreach/phlebs/route.ts
import { NextRequest } from 'next/server';
import { proxyJson, readJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(req: NextRequest) {
  const url = new URL(req.url);

  return proxyJson(req, {
    method: 'GET',
    path: '/api/medreach/phlebs',
    search: url.search,
  });
}

async function partnerOriginalPOST(req: NextRequest) {
  const body = await readJson(req);

  return proxyJson(req, {
    method: 'POST',
    path: '/api/medreach/phlebs',
    body,
  });
}
export const GET = withPartnerAdminProxy(partnerOriginalGET);
export const POST = withPartnerAdminProxy(partnerOriginalPOST);
