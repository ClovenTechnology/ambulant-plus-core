// apps/medreach/app/api/lab-networks/[networkId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyGateway } from '../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const networkId = clean(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}`,
    'GET',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const networkId = clean(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}`,
    'PATCH',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}