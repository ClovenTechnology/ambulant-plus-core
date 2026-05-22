// FILE: apps/api-gateway/app/api/careport/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

async function resolvePatientProfileIdFromUserId(userId: string) {
  if (!userId) return null;

  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    return profile?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  requireRole(who, ['patient', 'admin']);

  const url = new URL(req.url);
  const encounterId = clean(url.searchParams.get('encounterId'));
  const erxOrderId = clean(url.searchParams.get('erxOrderId'));
  const status = clean(url.searchParams.get('status')).toUpperCase();
  const fulfillment = clean(url.searchParams.get('fulfillment')).toUpperCase();

  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20)));

  const where: any = { orgId };

  if (encounterId) where.encounterId = encounterId;
  if (erxOrderId) where.erxOrderId = erxOrderId;
  if (status && status !== 'ALL') where.status = status;
  if (fulfillment === 'DELIVERY' || fulfillment === 'PICKUP') where.fulfillment = fulfillment;

  if (who.role === 'patient') {
    if (!who.uid) {
      return NextResponse.json({ ok: false, error: 'missing_uid' }, { status: 403 });
    }

    const profileId = await resolvePatientProfileIdFromUserId(who.uid);
    const allowedPatientIds = [who.uid, profileId].filter(Boolean).map(String);

    where.patientId = { in: allowedPatientIds };
  }

  const orders = await prisma.carePortOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      orgId: true,
      encounterId: true,
      erxOrderId: true,
      patientId: true,
      status: true,
      fulfillment: true,
      destinationAddr: true,
      currency: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      totalCents: true,
      createdAt: true,
      updatedAt: true,
      chosenPharmacyId: true,
      chosenOfferId: true,
      clientId: true,
      clientMemberId: true,
      coveragePlanId: true,
      coverageAuthorizationId: true,
      sponsorAmountMinor: true,
      patientCopayMinor: true,
      chosenPharmacy: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          supportsPickup: true,
          supportsDelivery: true,
        },
      },
    } as any,
  });

  return NextResponse.json(
    { ok: true, orders },
    {
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      },
    },
  );
}
