// apps/api-gateway/app/api/medreach/lab-networks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import {
  cleanBoolean,
  cleanNetworkType,
  cleanString,
  projectNetwork,
  roleOf,
  writeNetworkAudit,
} from '@/src/lib/medreach-lab-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const url = new URL(req.url);

  const q = cleanString(url.searchParams.get('q')).toLowerCase();
  const status = cleanString(url.searchParams.get('status')).toUpperCase();
  const active = url.searchParams.has('active')
    ? cleanBoolean(url.searchParams.get('active'), true)
    : true;

  const where: Record<string, any> = {};

  if (!['admin', 'system'].includes(role)) {
    if (!who.uid) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    where.OR = [
      { ownerUserId: who.uid },
      {
        staffMembers: {
          some: {
            userId: who.uid,
            active: true,
            status: 'ACTIVE',
          },
        },
      },
    ];
  }

  if (status) where.status = status as any;
  if (url.searchParams.has('active')) where.active = active;

  if (q) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { legalName: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const rows = await prisma.medReachLabNetwork.findMany({
    where,
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: {
        select: {
          branches: true,
          staffMembers: true,
        },
      },
    },
    take: 100,
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectNetwork),
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!['admin', 'system', 'lab', 'lab_staff'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const legalName = cleanString(body.legalName || body.name);
  const displayName = cleanString(body.displayName);
  const country = cleanString(body.country).toUpperCase().slice(0, 2) || 'ZA';
  const currency = cleanString(body.currency).toUpperCase().slice(0, 3) || 'ZAR';
  const admin = ['admin', 'system'].includes(role);

  if (!legalName) {
    return NextResponse.json({ ok: false, error: 'missing_legalName' }, { status: 400 });
  }

  const network = await prisma.medReachLabNetwork.create({
    data: {
      legalName,
      displayName: displayName || null,
      networkType: cleanNetworkType(body.networkType) as any,
      country,
      currency,
      ownerUserId: cleanString(body.ownerUserId) || who.uid || null,
      status: admin && cleanBoolean(body.approveNow, false) ? ('ACTIVE' as any) : ('PENDING' as any),
      active: admin ? cleanBoolean(body.active, true) : true,
      profileMeta: body.profileMeta && typeof body.profileMeta === 'object' ? (body.profileMeta as any) : undefined,
      verifiedIdentityMeta:
        admin && body.verifiedIdentityMeta && typeof body.verifiedIdentityMeta === 'object'
          ? (body.verifiedIdentityMeta as any)
          : undefined,
    },
    include: {
      _count: {
        select: {
          branches: true,
          staffMembers: true,
        },
      },
    },
  });

  await writeNetworkAudit('medreach_lab_network_created', who, network.id, {
    networkId: network.id,
    legalName: network.legalName,
    networkType: network.networkType,
  });

  emitEvent({
    kind: 'medreach_lab_network_created',
    payload: {
      networkId: network.id,
      legalName: network.legalName,
      networkType: network.networkType,
      at: new Date().toISOString(),
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectNetwork(network),
  });
}