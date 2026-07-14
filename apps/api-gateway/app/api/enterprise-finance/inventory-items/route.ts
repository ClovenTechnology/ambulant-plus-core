import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function boolOrDefault(value: any, fallback: boolean) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true';
}

function boolOrUndefined(value: any) {
  if (value === undefined || value === null) return undefined;
  return value === true || value === 'true';
}

function intValue(value: any, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function cents(value: any, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n * 100);
}

function dateOrNull(value: any) {
  const raw = text(value, 80);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function idempotencyKey(req: NextRequest) {
  return text(req.headers.get('Idempotency-Key'), 180) || null;
}

function safeAvailable(quantityOnHand: number, reservedQuantity: number) {
  return Math.max(quantityOnHand - reservedQuantity, 0);
}

function calculateLandingCost(input: any) {
  const baseZar = cents(input.zarEquivalent || input.zarEquivalentZar || input.zarEquivalentCents / 100);
  const importDuty = cents(input.importDuty || input.importDutyZar || input.importDutyCents / 100);
  const tax = cents(input.tax || input.taxZar || input.taxCents / 100);
  const vat = cents(input.vat || input.vatZar || input.vatCents / 100);
  const msp = cents(input.msp || input.mspZar || input.mspCents / 100);
  const shipping = cents(input.shipping || input.shippingZar || input.shippingCents / 100);
  const clearing = cents(input.clearing || input.clearingZar || input.clearingCents / 100);
  const handling = cents(input.handling || input.handlingZar || input.handlingCents / 100);
  const other = cents(input.otherLandingCost || input.otherLandingCostZar || input.otherLandingCostCents / 100);

  const totalLandingCostCents = baseZar + importDuty + tax + vat + msp + shipping + clearing + handling + other;

  return {
    importDutyCents: importDuty,
    taxCents: tax,
    vatCents: vat,
    mspCents: msp,
    shippingCents: shipping,
    clearingCents: clearing,
    handlingCents: handling,
    otherLandingCostCents: other,
    totalLandingCostCents,
  };
}
// A5_M_H_A_ENTERPRISE_FINANCE_INVENTORY_ITEM_ROUTE

async function auditItem(action: string, req: NextRequest, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsInventoryItem',
    subjectId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_inventory_item',
    ...extra,
  });
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const categoryId = text(searchParams.get('categoryId'), 180);
    const itemType = text(searchParams.get('itemType'), 100);
    const active = searchParams.get('active');
    const visibleSurface = text(searchParams.get('visibleSurface'), 80);
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
    const q = text(searchParams.get('q'), 160);
    const limitRaw = Number(searchParams.get('limit') || 200);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 200, 500));

    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (itemType) where.itemType = itemType;
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;
    if (visibleSurface === 'patient') where.patientVisible = true;
    if (visibleSurface === 'clinician') where.clinicianVisible = true;
    if (visibleSurface === 'medreach') where.medreachVisible = true;
    if (visibleSurface === 'careport') where.careportVisible = true;
    if (visibleSurface === 'admin') where.adminVisible = true;

    if (q) {
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { itemCode: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await db.opsInventoryItem.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      take: limit,
    });

    const filtered = lowStockOnly
      ? items.filter((item: any) => Number(item.quantityOnHand || 0) <= Number(item.lowStockThreshold || 0))
      : items;

    return json({ ok: true, envelope: access.envelope, items: filtered, meta: { count: filtered.length, limit, lowStockOnly } });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_inventory_item_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_inventory_item', 120);

    if (action !== 'create_inventory_item') {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_inventory_item_post_action', action }, 400);
    }

    const name = text(body.name, 240);
    if (!name) return json({ ok: false, envelope: access.envelope, error: 'inventory_item_name_required' }, 400);

    const quantityOnHand = intValue(body.quantityOnHand);
    const reservedQuantity = intValue(body.reservedQuantity);
    const availableQuantity = body.availableQuantity === undefined ? safeAvailable(quantityOnHand, reservedQuantity) : intValue(body.availableQuantity);

    const item = await db.opsInventoryItem.create({
      data: {
        sku: text(body.sku, 180),
        itemCode: text(body.itemCode, 180),
        categoryId: text(body.categoryId, 180),

        name,
        description: text(body.description, 4000),
        itemType: text(body.itemType || 'item', 100),

        manufacturer: text(body.manufacturer, 240),
        manufacturerContact: text(body.manufacturerContact, 500),
        brand: text(body.brand, 160),
        model: text(body.model, 160),
        barcode: text(body.barcode, 180),

        images: asObject(body.images || {}),
        primaryImageUrl: text(body.primaryImageUrl, 1200),
        primaryImageObjectKey: text(body.primaryImageObjectKey, 1200),

        currency: text(body.currency || 'ZAR', 3),
        unitCostCents: cents(body.unitCost || body.unitCostZar || body.unitCostCents / 100),
        unitPriceCents: cents(body.unitPrice || body.unitPriceZar || body.unitPriceCents / 100),
        lastLandingCostCents: cents(body.lastLandingCost || body.lastLandingCostZar || body.lastLandingCostCents / 100),

        quantityOnHand,
        reservedQuantity,
        availableQuantity,
        lowStockThreshold: intValue(body.lowStockThreshold),

        patientVisible: boolOrDefault(body.patientVisible, false),
        clinicianVisible: boolOrDefault(body.clinicianVisible, false),
        medreachVisible: boolOrDefault(body.medreachVisible, false),
        careportVisible: boolOrDefault(body.careportVisible, false),
        adminVisible: boolOrDefault(body.adminVisible, true),

        active: boolOrDefault(body.active, true),

        shopProductId: text(body.shopProductId, 180),
        shopVariantId: text(body.shopVariantId, 180),
        carePortSkuId: text(body.carePortSkuId, 180),
        deviceCatalogSlug: text(body.deviceCatalogSlug, 180),

        meta: asObject(body.meta || {}),
        createdByUserId: access.envelope.actor.userId,
      },
    });

    if (quantityOnHand !== 0) {
      await db.opsInventoryMovement.create({
        data: {
          movementType: 'opening_balance',
          status: 'posted',
          inventoryItemId: item.id,
          sourceType: 'ops_inventory_item',
          sourceId: item.id,
          quantityDelta: quantityOnHand,
          quantityBefore: 0,
          quantityAfter: quantityOnHand,
          unitCostCents: item.unitCostCents,
          totalCostCents: item.unitCostCents * quantityOnHand,
          currency: item.currency,
          narration: 'Opening inventory balance',
          reference: text(body.reference, 240),
          performedByUserId: access.envelope.actor.userId,
          occurredAt: new Date(),
          meta: asObject({ action, openingBalance: true }),
        },
      });
    }

    await auditItem('inventory_item_created', req, item.id, {
      name: item.name,
      quantityOnHand: item.quantityOnHand,
      availableQuantity: item.availableQuantity,
    });

    return json({ ok: true, envelope: access.envelope, item }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_inventory_item_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.inventoryItemId || body.itemId, 180);

    if (!action) return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    if (!id) return json({ ok: false, envelope: access.envelope, error: 'inventory_item_id_required' }, 400);

    const existing = await db.opsInventoryItem.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, envelope: access.envelope, error: 'inventory_item_not_found' }, 404);

    if (
      action === 'update_inventory_item' ||
      action === 'activate_inventory_item' ||
      action === 'archive_inventory_item' ||
      action === 'adjust_inventory_quantity' ||
      action === 'reserve_inventory_quantity' ||
      action === 'release_inventory_reservation'
    ) {
      let movement: any = null;
      let quantityOnHand = Number(existing.quantityOnHand || 0);
      let reservedQuantity = Number(existing.reservedQuantity || 0);
      let availableQuantity = Number(existing.availableQuantity || 0);

      if (action === 'adjust_inventory_quantity') {
        const quantityDelta = intValue(body.quantityDelta);
        const quantityBefore = quantityOnHand;
        quantityOnHand = Math.max(quantityOnHand + quantityDelta, 0);
        availableQuantity = safeAvailable(quantityOnHand, reservedQuantity);

        movement = await db.opsInventoryMovement.create({
          data: {
            movementType: text(body.movementType || 'manual_adjustment', 100),
            status: 'posted',
            inventoryItemId: id,
            sourceType: text(body.sourceType || 'manual_inventory_adjustment', 120),
            sourceId: text(body.sourceId, 180),
            quantityDelta,
            quantityBefore,
            quantityAfter: quantityOnHand,
            unitCostCents: cents(body.unitCost || body.unitCostZar || body.unitCostCents / 100, existing.unitCostCents || 0),
            totalCostCents: cents(body.totalCost || body.totalCostZar || body.totalCostCents / 100),
            currency: text(body.currency || existing.currency || 'ZAR', 3),
            narration: text(body.narration || 'Manual inventory adjustment', 2000),
            reference: text(body.reference, 240),
            performedByUserId: access.envelope.actor.userId,
            occurredAt: dateOrNull(body.occurredAt) || new Date(),
            meta: asObject(body.meta || {}),
          },
        });
      }

      if (action === 'reserve_inventory_quantity') {
        const quantityDelta = intValue(body.quantityDelta || body.quantity || 0);
        reservedQuantity = Math.max(reservedQuantity + quantityDelta, 0);
        availableQuantity = safeAvailable(quantityOnHand, reservedQuantity);
      }

      if (action === 'release_inventory_reservation') {
        const quantityDelta = intValue(body.quantityDelta || body.quantity || 0);
        reservedQuantity = Math.max(reservedQuantity - quantityDelta, 0);
        availableQuantity = safeAvailable(quantityOnHand, reservedQuantity);
      }

      const item = await db.opsInventoryItem.update({
        where: { id },
        data: defined({
          sku: body.sku === undefined ? undefined : text(body.sku, 180),
          itemCode: body.itemCode === undefined ? undefined : text(body.itemCode, 180),
          categoryId: body.categoryId === undefined ? undefined : text(body.categoryId, 180),

          name: body.name === undefined ? undefined : text(body.name, 240),
          description: body.description === undefined ? undefined : text(body.description, 4000),
          itemType: body.itemType === undefined ? undefined : text(body.itemType, 100),

          manufacturer: body.manufacturer === undefined ? undefined : text(body.manufacturer, 240),
          manufacturerContact: body.manufacturerContact === undefined ? undefined : text(body.manufacturerContact, 500),
          brand: body.brand === undefined ? undefined : text(body.brand, 160),
          model: body.model === undefined ? undefined : text(body.model, 160),
          barcode: body.barcode === undefined ? undefined : text(body.barcode, 180),

          images: body.images === undefined ? undefined : asObject(body.images),
          primaryImageUrl: body.primaryImageUrl === undefined ? undefined : text(body.primaryImageUrl, 1200),
          primaryImageObjectKey: body.primaryImageObjectKey === undefined ? undefined : text(body.primaryImageObjectKey, 1200),

          currency: body.currency === undefined ? undefined : text(body.currency, 3),
          unitCostCents: body.unitCost === undefined && body.unitCostZar === undefined && body.unitCostCents === undefined ? undefined : cents(body.unitCost || body.unitCostZar || body.unitCostCents / 100),
          unitPriceCents: body.unitPrice === undefined && body.unitPriceZar === undefined && body.unitPriceCents === undefined ? undefined : cents(body.unitPrice || body.unitPriceZar || body.unitPriceCents / 100),

          quantityOnHand: action === 'adjust_inventory_quantity' ? quantityOnHand : undefined,
          reservedQuantity:
            action === 'reserve_inventory_quantity' || action === 'release_inventory_reservation'
              ? reservedQuantity
              : undefined,
          availableQuantity:
            action === 'adjust_inventory_quantity' ||
            action === 'reserve_inventory_quantity' ||
            action === 'release_inventory_reservation'
              ? availableQuantity
              : undefined,

          lowStockThreshold: body.lowStockThreshold === undefined ? undefined : intValue(body.lowStockThreshold),

          patientVisible: boolOrUndefined(body.patientVisible),
          clinicianVisible: boolOrUndefined(body.clinicianVisible),
          medreachVisible: boolOrUndefined(body.medreachVisible),
          careportVisible: boolOrUndefined(body.careportVisible),
          adminVisible: boolOrUndefined(body.adminVisible),

          active:
            action === 'activate_inventory_item' ? true :
            action === 'archive_inventory_item' ? false :
            boolOrUndefined(body.active),

          shopProductId: body.shopProductId === undefined ? undefined : text(body.shopProductId, 180),
          shopVariantId: body.shopVariantId === undefined ? undefined : text(body.shopVariantId, 180),
          carePortSkuId: body.carePortSkuId === undefined ? undefined : text(body.carePortSkuId, 180),
          deviceCatalogSlug: body.deviceCatalogSlug === undefined ? undefined : text(body.deviceCatalogSlug, 180),

          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'activate_inventory_item' ? 'inventory_item_activated' :
        action === 'archive_inventory_item' ? 'inventory_item_archived' :
        action === 'adjust_inventory_quantity' ? 'inventory_quantity_adjusted' :
        action === 'reserve_inventory_quantity' ? 'inventory_quantity_reserved' :
        action === 'release_inventory_reservation' ? 'inventory_reservation_released' :
        'inventory_item_updated';

      await auditItem(auditAction, req, item.id, {
        quantityOnHand: item.quantityOnHand,
        reservedQuantity: item.reservedQuantity,
        availableQuantity: item.availableQuantity,
        stockMovementId: movement?.id || null,
      });

      return json({ ok: true, envelope: access.envelope, item, movement });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_inventory_item_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_inventory_item_patch_failed');
  }
}
