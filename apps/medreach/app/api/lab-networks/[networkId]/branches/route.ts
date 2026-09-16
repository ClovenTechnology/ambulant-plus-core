import { withPartnerRoute } from '@/lib/partner-route';
// apps/medreach/app/api/lab-networks/[networkId]/branches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyGateway } from '../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function partnerOriginalGET(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const networkId = clean(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}/branches`,
    'GET',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}

async function partnerOriginalPOST(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const networkId = clean(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}/branches`,
    'POST',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}
export const GET = withPartnerRoute(partnerOriginalGET);
export const POST = withPartnerRoute(partnerOriginalPOST);
