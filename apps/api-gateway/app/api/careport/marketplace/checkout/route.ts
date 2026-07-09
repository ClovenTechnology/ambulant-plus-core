import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRUSTED_SKU_NORMALISATION_STATUSES = [
  'MAPPED_TO_TEMPLATE',
  'ADMIN_VERIFIED',
  'GLOBAL_CATALOGUE_MATCHED',
];

type CheckoutLine = {
  skuId: string;
  qty: number;
};

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function asQty(value: unknown) {
  const parsed = Number.parseInt(String(value ?? '1'), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(parsed, 99);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function parseLines(body: any): CheckoutLine[] {
  const rows = Array.isArray(body?.lines)
    ? body.lines
    : Array.isArray(body?.items)
      ? body.items
      : [];

  const bySku = new Map<string, number>();

  for (const row of rows) {
    const skuId = clean(row?.skuId ?? row?.id, 120);
    if (!skuId) continue;

    bySku.set(skuId, Math.min(99, (bySku.get(skuId) || 0) + asQty(row?.qty ?? row?.quantity)));
  }

  return Array.from(bySku.entries()).map(([skuId, qty]) => ({ skuId, qty })).slice(0, 50);
}

async function resolvePatientId(userId: string) {
  if (!userId) return null;

  const profile = await prisma.patientProfile
    .findUnique({
      where: { userId },
      select: { id: true },
    })
    .catch(() => null);

  return profile?.id || userId;
}

function availableStock(sku: any) {
  if (typeof sku?.stockOnHand !== 'number') return null;
  return Math.max(0, Number(sku.stockOnHand || 0) - Number(sku.reservedStock || 0));
}

function orderItemKey(skuId: string) {
  return 'marketplace:' + skuId;
}

function marketplaceOrderRef() {
  return 'otc-marketplace-' + randomUUID();
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['patient', 'admin']);

    const body = await req.json().catch(() => ({}));
    const lines = parseLines(body);

    if (!lines.length) {
      return json({ ok: false, error: 'checkout_lines_required' }, 400);
    }

    const fulfillmentRaw = clean(body?.fulfillment ?? 'PICKUP', 20).toUpperCase();
    const fulfillment = fulfillmentRaw === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';

    const destination = body?.destination && typeof body.destination === 'object' ? body.destination : {};
    const destinationAddr = clean(body?.destinationAddr ?? destination?.addr ?? destination?.address, 500);
    const destinationLat = Number(destination?.lat ?? body?.destinationLat);
    const destinationLng = Number(destination?.lng ?? body?.destinationLng);

    if (fulfillment === 'DELIVERY' && !destinationAddr) {
      return json({ ok: false, error: 'delivery_address_required' }, 400);
    }

    const patientId =
      who.role === 'admin' && clean(body?.patientId, 120)
        ? clean(body?.patientId, 120)
        : await resolvePatientId(clean(who.uid, 120));

    if (!patientId) {
      return json({ ok: false, error: 'patient_identity_required' }, 403);
    }

    const skuIds = lines.map((line) => line.skuId);
    const qtyBySku = new Map(lines.map((line) => [line.skuId, line.qty]));

    const result = await prisma.$transaction(
      async (tx: any) => {
        const skus = await tx.carePortPharmacySku.findMany({
          where: {
            orgId,
            id: { in: skuIds },
            isActive: true,
            marketplaceVisible: true,
            sellableOnline: true,
            prescriptionRequired: false,
            reviewRequired: false,
            globalProductId: { not: null },
            normalisationStatus: { in: TRUSTED_SKU_NORMALISATION_STATUSES },
            pharmacy: {
              active: true,
            },
          },
          select: {
            id: true,
            orgId: true,
            pharmacyId: true,
            name: true,
            drugCode: true,
            skuCode: true,
            barcode: true,
            canonicalName: true,
            globalProductId: true,
            globalProductKey: true,
            productType: true,
            category: true,
            otc: true,
            prescriptionRequired: true,
            marketplaceVisible: true,
            sellableOnline: true,
            reviewRequired: true,
            normalisationStatus: true,
            priceCents: true,
            currency: true,
            stockOnHand: true,
            reservedStock: true,
            maxOrderQty: true,
            pharmacy: {
              select: {
                id: true,
                name: true,
                active: true,
                supportsPickup: true,
                supportsDelivery: true,
              },
            },
          },
        });

        if (skus.length !== skuIds.length) {
          const found = new Set(skus.map((sku: any) => sku.id));
          const missing = skuIds.filter((skuId) => !found.has(skuId));

          throw Object.assign(new Error('one_or_more_skus_not_marketplace_eligible'), {
            status: 409,
            details: { missing },
          });
        }

        const pharmacyIds = Array.from(new Set(skus.map((sku: any) => sku.pharmacyId)));
        if (pharmacyIds.length !== 1) {
          throw Object.assign(new Error('single_pharmacy_checkout_required'), { status: 409 });
        }

        const pharmacy = skus[0]?.pharmacy;
        if (!pharmacy?.active) {
          throw Object.assign(new Error('pharmacy_not_active'), { status: 409 });
        }

        if (fulfillment === 'PICKUP' && !pharmacy.supportsPickup) {
          throw Object.assign(new Error('pharmacy_pickup_not_supported'), { status: 409 });
        }

        if (fulfillment === 'DELIVERY' && !pharmacy.supportsDelivery) {
          throw Object.assign(new Error('pharmacy_delivery_not_supported'), { status: 409 });
        }

        const currencies = Array.from(new Set(skus.map((sku: any) => sku.currency || 'ZAR')));
        if (currencies.length !== 1) {
          throw Object.assign(new Error('single_currency_checkout_required'), { status: 409 });
        }

        const globalProductIds = Array.from(
          new Set(skus.map((sku: any) => clean(sku.globalProductId, 191)).filter(Boolean)),
        );

        const globalProducts = await tx.carePortGlobalProduct.findMany({
          where: {
            orgId,
            id: { in: globalProductIds },
            catalogueStatus: 'ACTIVE',
            marketplaceAllowed: true,
            sellableOnline: true,
            prescriptionRequired: false,
          },
          select: {
            id: true,
            canonicalName: true,
            marketplaceAllowed: true,
            sellableOnline: true,
            prescriptionRequired: true,
            catalogueStatus: true,
          },
        });

        const approvedGlobalIds = new Set(globalProducts.map((item: any) => item.id));

        for (const sku of skus) {
          if (!approvedGlobalIds.has(sku.globalProductId)) {
            throw Object.assign(new Error('global_product_not_marketplace_approved'), {
              status: 409,
              details: { skuId: sku.id, globalProductId: sku.globalProductId },
            });
          }

          const qty = Number(qtyBySku.get(sku.id) || 1);
          const maxOrderQty = Number(sku.maxOrderQty || 0);

          if (maxOrderQty > 0 && qty > maxOrderQty) {
            throw Object.assign(new Error('max_order_qty_exceeded'), {
              status: 409,
              details: { skuId: sku.id, maxOrderQty },
            });
          }

          const stockAvailable = availableStock(sku);
          if (stockAvailable != null && stockAvailable < qty) {
            throw Object.assign(new Error('insufficient_stock'), {
              status: 409,
              details: { skuId: sku.id, availableStock: stockAvailable, requestedQty: qty },
            });
          }
        }

        const subtotalCents = skus.reduce((sum: number, sku: any) => {
          return sum + Number(sku.priceCents || 0) * Number(qtyBySku.get(sku.id) || 1);
        }, 0);

        const deliveryFeeCents = 0;
        const totalCents = subtotalCents + deliveryFeeCents;
        const currency = currencies[0] || 'ZAR';
        const erxOrderId = marketplaceOrderRef();

        const order = await tx.carePortOrder.create({
          data: {
            orgId,
            erxOrderId,
            refillNo: 0,
            encounterId: 'marketplace:' + erxOrderId,
            patientId,
            status: 'PAYMENT_PENDING',
            fulfillment,
            destinationAddr: fulfillment === 'DELIVERY' ? destinationAddr : null,
            destinationLat: fulfillment === 'DELIVERY' && Number.isFinite(destinationLat) ? destinationLat : null,
            destinationLng: fulfillment === 'DELIVERY' && Number.isFinite(destinationLng) ? destinationLng : null,
            chosenPharmacyId: pharmacyIds[0],
            subtotalCents,
            deliveryFeeCents,
            totalCents,
            currency,
            patientCopayMinor: totalCents,
            sponsorAmountMinor: 0,
            pharmacyGrossMinor: subtotalCents,
            pharmacyNetMinor: subtotalCents,
            platformFeeMinor: 0,
            paymentProviderFeeMinor: 0,
            riderFeeMinor: 0,
            riderNetMinor: 0,
            settlementStatus: 'UNSETTLED',
            sponsorPricingSnapshot: {
              source: 'CAREPORT_OTC_MARKETPLACE',
              coverage: 'SELF_PAY',
              prescriptionRequiredBlocked: true,
            },
          },
          select: {
            id: true,
            orgId: true,
            erxOrderId: true,
            patientId: true,
            status: true,
            fulfillment: true,
            chosenPharmacyId: true,
            subtotalCents: true,
            deliveryFeeCents: true,
            totalCents: true,
            currency: true,
            createdAt: true,
          },
        });

        const createdItems: any[] = [];

        for (const sku of skus) {
          const qty = Number(qtyBySku.get(sku.id) || 1);

          await tx.carePortPharmacySku.update({
            where: { id: sku.id },
            data: {
              reservedStock: {
                increment: qty,
              },
            },
          });

          const item = await tx.carePortOrderItem.create({
            data: {
              orderId: order.id,
              erxMedKey: orderItemKey(sku.id),
              drugCode: sku.drugCode || sku.skuCode || sku.barcode || sku.globalProductKey || null,
              name: sku.canonicalName || sku.name,
              quantity: qty,
              directions: 'OTC marketplace purchase. No prescription required.',
            },
            select: {
              id: true,
              orderId: true,
              erxMedKey: true,
              drugCode: true,
              name: true,
              quantity: true,
            },
          });

          await tx.carePortSelection.create({
            data: {
              orgId,
              orderId: order.id,
              orderItemId: item.id,
              chosenSkuId: sku.id,
              unitPriceCents: Number(sku.priceCents || 0),
              currency,
            },
          });

          createdItems.push({
            ...item,
            skuId: sku.id,
            unitPriceCents: Number(sku.priceCents || 0),
            lineTotalCents: Number(sku.priceCents || 0) * qty,
          });
        }

        return {
          order,
          items: createdItems,
          reservation: {
            reserved: createdItems.map((item) => ({
              skuId: item.skuId,
              qty: item.quantity,
            })),
          },
        };
      },
      {
        isolationLevel: 'Serializable' as any,
      },
    );

    return json({
      ok: true,
      order: result.order,
      items: result.items,
      reservation: result.reservation,
      next: {
        paymentRequired: true,
        status: 'PAYMENT_PENDING',
      },
    }, 201);
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || 'careport_marketplace_checkout_failed',
        details: error?.details || null,
      },
      error?.status || 500,
    );
  }
}