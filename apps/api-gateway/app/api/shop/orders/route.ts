// apps/api-gateway/app/api/shop/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChannelQ = 'clinician' | 'patient' | 'medreach' | 'careport';

function toChannelEnum(ch: ChannelQ) {
  switch (ch) {
    case 'clinician':
      return 'CLINICIAN';
    case 'patient':
      return 'PATIENT';
    case 'medreach':
      return 'MEDREACH';
    case 'careport':
      return 'CAREPORT';
  }
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeOrderTotalZar(order: any) {
  if (typeof order?.totalZar === 'number') return order.totalZar;
  if (typeof order?.totalAmountZar === 'number') return order.totalAmountZar;
  if (typeof order?.totalCents === 'number') return Math.round(order.totalCents) / 100;

  const items = Array.isArray(order?.items) ? order.items : [];
  let sum = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.round(num(it?.quantity)));
    const unitZar =
      typeof it?.unitAmountZar === 'number'
        ? it.unitAmountZar
        : typeof it?.unitPriceZar === 'number'
        ? it.unitPriceZar
        : 0;
    sum += unitZar * qty;
  }
  return sum;
}

/**
 * Owner matching without assuming a specific schema field name.
 * We strictly FILTER IN MEMORY and *never* return orders if we cannot confidently match uid.
 * This avoids leakage even if the DB schema differs.
 */
function orderOwnedByUid(order: any, uid: string) {
  if (!uid) return false;

  // direct candidate fields we might have
  const direct = [
    order?.buyerId,
    order?.buyerUid,
    order?.userId,
    order?.customerId,
    order?.patientId,
    order?.clinicianId,
    order?.ownerId,
  ]
    .map((x) => (x == null ? '' : String(x)))
    .filter(Boolean);

  if (direct.some((x) => x === uid)) return true;

  // providerMeta / meta might be objects or JSON strings
  const blobs: any[] = [];

  if (order?.providerMeta) blobs.push(order.providerMeta);
  if (order?.meta) blobs.push(order.meta);

  for (const b of blobs) {
    // object
    if (b && typeof b === 'object') {
      const candidates = [
        b?.buyerUid,
        b?.buyerId,
        b?.uid,
        b?.userId,
        b?.customerId,
        b?.patientId,
        b?.clinicianId,
        b?.ownerId,
        b?.paystack?.customer?.id,
        b?.paystack?.customer?.email, // sometimes used as id in demos
      ]
        .map((x) => (x == null ? '' : String(x)))
        .filter(Boolean);

      if (candidates.some((x) => x === uid)) return true;
    }

    // JSON string
    if (typeof b === 'string') {
      try {
        const js = JSON.parse(b);
        if (js && typeof js === 'object') {
          const candidates = [
            js?.buyerUid,
            js?.buyerId,
            js?.uid,
            js?.userId,
            js?.customerId,
            js?.patientId,
            js?.clinicianId,
            js?.ownerId,
          ]
            .map((x: any) => (x == null ? '' : String(x)))
            .filter(Boolean);

          if (candidates.some((x: string) => x === uid)) return true;
        }
      } catch {
        // ignore
      }
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const channelQ = (url.searchParams.get('channel') || 'patient') as ChannelQ;
  const channel = toChannelEnum(channelQ);

  const statusQ = String(url.searchParams.get('status') || '').trim();
  const q = String(url.searchParams.get('q') || '').trim();
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') || 50)));

  // In dev/demo we also accept uid query param, but prefer header.
  const uid =
    String(req.headers.get('x-uid') || '').trim() ||
    String(url.searchParams.get('uid') || '').trim();

  if (!uid) {
    return NextResponse.json({ ok: false, error: 'Missing x-uid' }, { status: 401 });
  }

  const where: any = {
    channel,
  };

  if (statusQ && statusQ !== 'ALL') {
    const parts = statusQ.split(',').map((s) => s.trim()).filter(Boolean);
    where.status = parts.length > 1 ? { in: parts } : parts[0];
  }

  if (q) {
    where.id = { contains: q, mode: 'insensitive' };
  }

  // Fetch a superset, then filter strictly by ownership in-memory.
  const orders = (await prisma.shopOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.max(take * 3, 100), // buffer so we still return enough after filtering
    include: { items: true },
  })) as any[];

  const owned = orders.filter((o) => orderOwnedByUid(o, uid)).slice(0, take);

  // If we can't match any ownership at all, return empty (safe-by-default)
  const items = owned.map((o) => ({
    id: String(o.id),
    status: String(o.status || ''),
    channel: o.channel ?? null,
    currency: o.currency ?? 'ZAR',
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
    itemCount: Array.isArray(o.items) ? o.items.length : 0,
    totalZar: computeOrderTotalZar(o),
  }));

  return NextResponse.json({ ok: true, items });
}
