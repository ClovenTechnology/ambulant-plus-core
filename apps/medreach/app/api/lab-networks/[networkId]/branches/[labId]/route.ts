// apps/medreach/app/api/lab-networks/[networkId]/branches/[labId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyGateway } from '../../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { networkId: string; labId: string } },
) {
  const networkId = clean(params.networkId);
  const labId = clean(params.labId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}/branches/${encodeURIComponent(labId)}`,
    'PATCH',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { networkId: string; labId: string } },
) {
  const networkId = clean(params.networkId);
  const labId = clean(params.labId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}/branches/${encodeURIComponent(labId)}`,
    'DELETE',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}