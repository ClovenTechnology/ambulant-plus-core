type ReservationAction = 'capture' | 'release';

type ReservationArgs = {
  orderId: string;
  action: ReservationAction;
  reason: string;
  actorId?: string | null;
  actorRole?: string | null;
};

function asObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function isCarePortMarketplaceOrder(order: any) {
  const erxOrderId = clean(order?.erxOrderId, 240);
  const snapshot = asObject(order?.sponsorPricingSnapshot);

  return (
    erxOrderId.startsWith('otc-marketplace-') ||
    snapshot?.source === 'CAREPORT_OTC_MARKETPLACE' ||
    snapshot?.marketplaceReservation?.source === 'CAREPORT_OTC_MARKETPLACE'
  );
}

function existingReservationState(order: any) {
  return asObject(asObject(order?.sponsorPricingSnapshot)?.marketplaceReservation);
}

function terminalKey(action: ReservationAction) {
  return action === 'capture' ? 'capturedAt' : 'releasedAt';
}

async function reservationLines(tx: any, orderId: string) {
  const items = await tx.carePortOrderItem.findMany({
    where: { orderId },
    select: { id: true, quantity: true, name: true },
  });

  const selections = await tx.carePortSelection.findMany({
    where: { orderId },
    select: {
      orderItemId: true,
      chosenSkuId: true,
      unitPriceCents: true,
      currency: true,
    },
  });

  const quantityByItem = new Map<string, number>();
  for (const item of items) {
    quantityByItem.set(item.id, Math.max(1, Number(item.quantity || 1)));
  }

  const quantityBySku = new Map<string, { qty: number; orderItemIds: string[] }>();

  for (const selection of selections) {
    const skuId = clean(selection.chosenSkuId, 160);
    if (!skuId) continue;

    const qty = Math.max(1, quantityByItem.get(selection.orderItemId) || 1);
    const existing = quantityBySku.get(skuId) || { qty: 0, orderItemIds: [] };

    existing.qty += qty;
    existing.orderItemIds.push(selection.orderItemId);

    quantityBySku.set(skuId, existing);
  }

  return Array.from(quantityBySku.entries()).map(([skuId, value]) => ({
    skuId,
    qty: value.qty,
    orderItemIds: value.orderItemIds,
  }));
}

export async function applyMarketplaceReservationTransition(tx: any, args: ReservationArgs) {
  const order = await tx.carePortOrder.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      erxOrderId: true,
      status: true,
      sponsorPricingSnapshot: true,
    },
  });

  if (!order || !isCarePortMarketplaceOrder(order)) {
    return { ok: true, skipped: true, reason: 'not_marketplace_order' };
  }

  const snapshot = asObject(order.sponsorPricingSnapshot);
  const current = existingReservationState(order);
  const key = terminalKey(args.action);

  if (current.capturedAt) {
    return {
      ok: true,
      skipped: true,
      reason: 'reservation_already_captured',
      marketplaceReservation: current,
    };
  }

  if (args.action === 'release' && current.releasedAt) {
    return {
      ok: true,
      skipped: true,
      reason: 'reservation_already_released',
      marketplaceReservation: current,
    };
  }

  const lines = await reservationLines(tx, args.orderId);

  if (!lines.length) {
    return { ok: true, skipped: true, reason: 'no_reservation_lines' };
  }

  const mutations: any[] = [];

  for (const line of lines) {
    if (args.action === 'release') {
      const result = await tx.carePortPharmacySku.updateMany({
        where: {
          id: line.skuId,
          reservedStock: { gte: line.qty },
        },
        data: {
          reservedStock: { decrement: line.qty },
        },
      });

      mutations.push({
        skuId: line.skuId,
        qty: line.qty,
        released: result.count === 1,
      });

      continue;
    }

    const sku = await tx.carePortPharmacySku.findUnique({
      where: { id: line.skuId },
      select: {
        id: true,
        stockOnHand: true,
        reservedStock: true,
      },
    });

    if (!sku) {
      throw Object.assign(new Error('reserved_sku_not_found'), {
        status: 409,
        details: { skuId: line.skuId },
      });
    }

    const where: any = {
      id: line.skuId,
      reservedStock: { gte: line.qty },
    };

    const data: any = {
      reservedStock: { decrement: line.qty },
    };

    if (typeof sku.stockOnHand === 'number') {
      where.stockOnHand = { gte: line.qty };
      data.stockOnHand = { decrement: line.qty };
    }

    const result = await tx.carePortPharmacySku.updateMany({ where, data });

    if (result.count !== 1) {
      throw Object.assign(new Error('insufficient_stock_for_marketplace_capture'), {
        status: 409,
        details: {
          skuId: line.skuId,
          requestedQty: line.qty,
          stockOnHand: sku.stockOnHand,
          reservedStock: sku.reservedStock,
        },
      });
    }

    mutations.push({
      skuId: line.skuId,
      qty: line.qty,
      captured: true,
      stockOnHandTracked: typeof sku.stockOnHand === 'number',
    });
  }

  const now = new Date().toISOString();

  const marketplaceReservation = {
    ...current,
    source: 'CAREPORT_OTC_MARKETPLACE',
    lastAction: args.action,
    lastReason: args.reason,
    lastActorId: args.actorId || null,
    lastActorRole: args.actorRole || null,
    lastAt: now,
    [key]: now,
    lines: mutations,
  };

  await tx.carePortOrder.update({
    where: { id: args.orderId },
    data: {
      sponsorPricingSnapshot: {
        ...snapshot,
        marketplaceReservation,
      },
    } as any,
  });

  return {
    ok: true,
    action: args.action,
    reason: args.reason,
    marketplaceReservation,
  };
}