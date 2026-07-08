// apps/medreach/app/api/lab-networks/[networkId]/staff/[staffId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, proxyGateway } from '../../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { networkId: string; staffId: string } },
) {
  const networkId = clean(params.networkId);
  const staffId = clean(params.staffId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}/staff/${encodeURIComponent(staffId)}`,
    'PATCH',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { networkId: string; staffId: string } },
) {
  const networkId = clean(params.networkId);
  const staffId = clean(params.staffId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'missing_staffId' }, { status: 400 });
  }

  return proxyGateway(
    req,
    `/api/medreach/lab-networks/${encodeURIComponent(networkId)}/staff/${encodeURIComponent(staffId)}`,
    'DELETE',
    { 'x-network-id': req.headers.get('x-network-id') || networkId },
  );
}