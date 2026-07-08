// apps/api-gateway/app/api/medreach/lab-networks/[networkId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import {
  canManageNetwork,
  canReadNetwork,
  cleanBoolean,
  cleanNetworkType,
  cleanString,
  projectNetwork,
  roleOf,
  writeNetworkAudit,
} from '@/src/lib/medreach-lab-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const who = readIdentity(req.headers);
  const networkId = cleanString(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  const allowed = await canReadNetwork(req, networkId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const network = await prisma.medReachLabNetwork.findUnique({
    where: { id: networkId },
    include: {
      _count: {
        select: {
          branches: true,
          staffMembers: true,
        },
      },
    },
  });

  if (!network) {
    return NextResponse.json({ ok: false, error: 'network_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: projectNetwork(network),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { networkId: string } },
) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const networkId = cleanString(params.networkId);

  if (!networkId) {
    return NextResponse.json({ ok: false, error: 'missing_networkId' }, { status: 400 });
  }

  const allowed = await canManageNetwork(req, networkId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const admin = ['admin', 'system'].includes(role);
  const data: Record<string, any> = {};

  if ('legalName' in body) data.legalName = cleanString(body.legalName);
  if ('displayName' in body) data.displayName = cleanString(body.displayName) || null;
  if ('networkType' in body) data.networkType = cleanNetworkType(body.networkType) as any;
  if ('country' in body && admin) data.country = cleanString(body.country).toUpperCase().slice(0, 2) || 'ZA';
  if ('currency' in body && admin) data.currency = cleanString(body.currency).toUpperCase().slice(0, 3) || 'ZAR';
  if ('ownerUserId' in body && admin) data.ownerUserId = cleanString(body.ownerUserId) || null;
  if ('status' in body && admin) data.status = cleanString(body.status).toUpperCase() as any;
  if ('active' in body && admin) data.active = cleanBoolean(body.active, true);
  if ('profileMeta' in body && body.profileMeta && typeof body.profileMeta === 'object') {
    data.profileMeta = body.profileMeta as any;
  }

  if ('verifiedIdentityMeta' in body) {
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'locked_network_identity_field' },
        { status: 403 },
      );
    }

    data.verifiedIdentityMeta =
      body.verifiedIdentityMeta && typeof body.verifiedIdentityMeta === 'object'
        ? (body.verifiedIdentityMeta as any)
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const network = await prisma.medReachLabNetwork.update({
    where: { id: networkId },
    data,
    include: {
      _count: {
        select: {
          branches: true,
          staffMembers: true,
        },
      },
    },
  });

  await writeNetworkAudit('medreach_lab_network_updated', who, network.id, {
    networkId,
    changedFields: Object.keys(data),
  });

  emitEvent({
    kind: 'medreach_lab_network_updated',
    payload: {
      networkId,
      changedFields: Object.keys(data),
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectNetwork(network),
  });
}