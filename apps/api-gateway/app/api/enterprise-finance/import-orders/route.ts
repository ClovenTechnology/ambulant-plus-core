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
// A5_M_H_A_ENTERPRISE_FINANCE_IMPORT_ORDER_ROUTE

async function auditImportOrder(action: string, req: NextRequest, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsImportOrder',
    subjectId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_import_order',
    ...extra,
  });
}

async function requireActiveVendor(db: any, vendorId: string | null) {
  if (!vendorId) return { error: 'registered_vendor_required', status: 400 };

  const vendor = await db.opsVendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { error: 'registered_vendor_required', status: 400 };
  if (vendor.status !== 'active') return { error: 'active_vendor_required', status: 400, vendor };

  return { vendor };
}

function landedCostPerUnit(totalLandingCostCents: number, quantity: number) {
  const q = Math.max(quantity, 1);
  return Math.round(totalLandingCostCents / q);
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const status = text(searchParams.get('status'), 80);
    const vendorId = text(searchParams.get('vendorId'), 180);
    const inventoryItemId = text(searchParams.get('inventoryItemId'), 180);
    const q = text(searchParams.get('q'), 160);
    const limitRaw = Number(searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 500));

    const where: any = {};
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (inventoryItemId) where.inventoryItemId = inventoryItemId;

    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        { itemName: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { paymentReference: { contains: q, mode: 'insensitive' } },
      ];
    }

    const importOrders = await db.opsImportOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, importOrders, meta: { count: importOrders.length, limit } });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_import_order_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_import_order', 120);

    if (action !== 'create_import_order') {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_import_order_post_action', action }, 400);
    }

    const vendorId = text(body.vendorId, 180);
    const vendorCheck = await requireActiveVendor(db, vendorId);
    if (!vendorCheck.vendor) {
      return json({ ok: false, envelope: access.envelope, error: vendorCheck.error }, vendorCheck.status);
    }

    const itemName = text(body.itemName || body.name, 240);
    if (!itemName) return json({ ok: false, envelope: access.envelope, error: 'import_item_name_required' }, 400);

    const quantityOrdered = intValue(body.quantityOrdered || body.quantity);
    if (quantityOrdered <= 0) return json({ ok: false, envelope: access.envelope, error: 'quantity_ordered_required' }, 400);

    const landing = calculateLandingCost(body);
    const totalCostUsdCents = cents(body.totalCostUsd || body.usdTotal || body.totalCostUsdCents / 100);
    const zarEquivalentCents = cents(body.zarEquivalent || body.zarEquivalentZar || body.zarEquivalentCents / 100);

    const importOrder = await db.opsImportOrder.create({
      data: {
        orderNumber: text(body.orderNumber, 180),
        status: text(body.status || 'draft', 80),

        vendorId,
        vendorName: vendorCheck.vendor.legalName || vendorCheck.vendor.tradingName,

        inventoryItemId: text(body.inventoryItemId, 180),
        inventoryCategoryId: text(body.inventoryCategoryId || body.categoryId, 180),

        itemName,
        itemDescription: text(body.itemDescription || body.description, 4000),
        itemType: text(body.itemType || 'item', 100),

        manufacturer: text(body.manufacturer, 240),
        manufacturerContact: text(body.manufacturerContact, 500),

        quantityOrdered,
        quantityReceived: intValue(body.quantityReceived),
        quantityAccepted: intValue(body.quantityAccepted),
        quantityRejected: intValue(body.quantityRejected),

        totalCostUsdCents,
        zarEquivalentCents,
        fxRate: body.fxRate === undefined ? null : Number(body.fxRate),

        invoiceUrl: text(body.invoiceUrl, 1200),
        invoiceObjectKey: text(body.invoiceObjectKey, 1200),
        paymentMethod: text(body.paymentMethod, 80),
        paymentReference: text(body.paymentReference, 240),
        proofOfPaymentUrl: text(body.proofOfPaymentUrl, 1200),
        proofOfPaymentObjectKey: text(body.proofOfPaymentObjectKey, 1200),

        orderDate: dateOrNull(body.orderDate),
        paymentDate: dateOrNull(body.paymentDate),
        expectedDeliveryDate: dateOrNull(body.expectedDeliveryDate),
        shippedAt: dateOrNull(body.shippedAt),
        deliveredAt: dateOrNull(body.deliveredAt),
        receivedAt: dateOrNull(body.receivedAt),
        inspectedAt: dateOrNull(body.inspectedAt),

        receivedByUserId: text(body.receivedByUserId, 180),
        inspectedByUserId: text(body.inspectedByUserId, 180),
        qualityStatus: text(body.qualityStatus, 80),
        inspectionNotes: text(body.inspectionNotes, 4000),
        discrepancyNotes: text(body.discrepancyNotes, 4000),

        importDutyCents: landing.importDutyCents,
        taxCents: landing.taxCents,
        vatCents: landing.vatCents,
        mspCents: landing.mspCents,
        shippingCents: landing.shippingCents,
        clearingCents: landing.clearingCents,
        handlingCents: landing.handlingCents,
        otherLandingCostCents: landing.otherLandingCostCents,
        totalLandingCostCents: landing.totalLandingCostCents,
        landingCostPerUnitCents: landedCostPerUnit(landing.totalLandingCostCents, quantityOrdered),

        expenditureLedgerEntryId: text(body.expenditureLedgerEntryId, 180),
        vendorInvoiceId: text(body.vendorInvoiceId, 180),

        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: Boolean(body.approveNow) ? access.envelope.actor.userId : null,
        approvedAt: Boolean(body.approveNow) ? new Date() : null,

        meta: asObject({
          ...(body.meta || {}),
          action,
          landedCostCalculated: true,
        }),
      },
    });

    await auditImportOrder('import_order_created', req, importOrder.id, {
      vendorId,
      quantityOrdered: importOrder.quantityOrdered,
      totalLandingCostCents: importOrder.totalLandingCostCents,
    });

    return json({ ok: true, envelope: access.envelope, importOrder }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_import_order_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.importOrderId, 180);

    if (!action) return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    if (!id) return json({ ok: false, envelope: access.envelope, error: 'import_order_id_required' }, 400);

    const existing = await db.opsImportOrder.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, envelope: access.envelope, error: 'import_order_not_found' }, 404);

    if (
      action === 'update_import_order' ||
      action === 'approve_import_order' ||
      action === 'mark_import_order_paid' ||
      action === 'mark_import_order_shipped' ||
      action === 'receive_import_order' ||
      action === 'inspect_import_order' ||
      action === 'accept_import_stock' ||
      action === 'archive_import_order' ||
      action === 'void_import_order'
    ) {
      const landing = calculateLandingCost({
        zarEquivalentCents: existing.zarEquivalentCents,
        importDutyCents: existing.importDutyCents,
        taxCents: existing.taxCents,
        vatCents: existing.vatCents,
        mspCents: existing.mspCents,
        shippingCents: existing.shippingCents,
        clearingCents: existing.clearingCents,
        handlingCents: existing.handlingCents,
        otherLandingCostCents: existing.otherLandingCostCents,
        ...body,
      });

      const quantityReceived =
        action === 'receive_import_order'
          ? intValue(body.quantityReceived || body.quantity, existing.quantityReceived || 0)
          : body.quantityReceived === undefined
            ? undefined
            : intValue(body.quantityReceived);

      const quantityAccepted =
        action === 'accept_import_stock'
          ? intValue(body.quantityAccepted || body.quantity || existing.quantityAccepted || existing.quantityReceived || 0)
          : body.quantityAccepted === undefined
            ? undefined
            : intValue(body.quantityAccepted);

      const quantityRejected =
        body.quantityRejected === undefined
          ? undefined
          : intValue(body.quantityRejected);

      const quantityForUnitCost =
        quantityAccepted ||
        quantityReceived ||
        existing.quantityAccepted ||
        existing.quantityReceived ||
        existing.quantityOrdered ||
        1;

      let stockMovement: any = null;
      let inventoryItem: any = null;
      let stockPostedAt: Date | undefined = undefined;

      if (action === 'accept_import_stock') {
        const inventoryItemId = text(body.inventoryItemId || existing.inventoryItemId, 180);
        if (!inventoryItemId) {
          return json({ ok: false, envelope: access.envelope, error: 'inventory_item_required_to_accept_stock' }, 400);
        }

        const item = await db.opsInventoryItem.findUnique({ where: { id: inventoryItemId } });
        if (!item) {
          return json({ ok: false, envelope: access.envelope, error: 'inventory_item_not_found' }, 404);
        }

        const acceptedQty = Math.max(quantityAccepted || 0, 0);
        if (acceptedQty <= 0) {
          return json({ ok: false, envelope: access.envelope, error: 'accepted_quantity_required' }, 400);
        }

        const quantityBefore = Number(item.quantityOnHand || 0);
        const quantityAfter = quantityBefore + acceptedQty;
        const reservedQuantity = Number(item.reservedQuantity || 0);
        const availableQuantity = safeAvailable(quantityAfter, reservedQuantity);
        const unitLandingCost = landedCostPerUnit(landing.totalLandingCostCents, acceptedQty);

        stockMovement = await db.opsInventoryMovement.create({
          data: {
            movementType: 'import_acceptance',
            status: 'posted',
            inventoryItemId,
            sourceType: 'ops_import_order',
            sourceId: existing.id,
            importOrderId: existing.id,

            quantityDelta: acceptedQty,
            quantityBefore,
            quantityAfter,

            unitCostCents: unitLandingCost,
            totalCostCents: landing.totalLandingCostCents,
            currency: 'ZAR',

            narration: text(body.narration || `Accepted import stock for ${existing.itemName}`, 2000),
            reference: text(body.reference || existing.orderNumber, 240),
            performedByUserId: access.envelope.actor.userId,
            occurredAt: new Date(),

            meta: asObject({
              action,
              qualityStatus: text(body.qualityStatus || 'accepted', 80),
              importOrderId: existing.id,
            }),
          },
        });

        inventoryItem = await db.opsInventoryItem.update({
          where: { id: inventoryItemId },
          data: {
            quantityOnHand: quantityAfter,
            availableQuantity,
            lastLandingCostCents: unitLandingCost,
          },
        });

        stockPostedAt = new Date();
      }

      const importOrder = await db.opsImportOrder.update({
        where: { id },
        data: defined({
          orderNumber: body.orderNumber === undefined ? undefined : text(body.orderNumber, 180),
          status:
            action === 'approve_import_order' ? 'approved' :
            action === 'mark_import_order_paid' ? 'paid' :
            action === 'mark_import_order_shipped' ? 'in_transit' :
            action === 'receive_import_order' ? 'received' :
            action === 'inspect_import_order' ? 'inspected' :
            action === 'accept_import_stock' ? 'accepted' :
            action === 'archive_import_order' ? 'archived' :
            action === 'void_import_order' ? 'voided' :
            body.status === undefined ? undefined : text(body.status, 80),

          inventoryItemId: body.inventoryItemId === undefined ? undefined : text(body.inventoryItemId, 180),
          inventoryCategoryId: body.inventoryCategoryId === undefined && body.categoryId === undefined ? undefined : text(body.inventoryCategoryId || body.categoryId, 180),

          itemName: body.itemName === undefined && body.name === undefined ? undefined : text(body.itemName || body.name, 240),
          itemDescription: body.itemDescription === undefined && body.description === undefined ? undefined : text(body.itemDescription || body.description, 4000),
          itemType: body.itemType === undefined ? undefined : text(body.itemType, 100),

          manufacturer: body.manufacturer === undefined ? undefined : text(body.manufacturer, 240),
          manufacturerContact: body.manufacturerContact === undefined ? undefined : text(body.manufacturerContact, 500),

          quantityOrdered: body.quantityOrdered === undefined && body.quantity === undefined ? undefined : intValue(body.quantityOrdered || body.quantity),
          quantityReceived,
          quantityAccepted,
          quantityRejected,

          totalCostUsdCents: body.totalCostUsd === undefined && body.usdTotal === undefined && body.totalCostUsdCents === undefined ? undefined : cents(body.totalCostUsd || body.usdTotal || body.totalCostUsdCents / 100),
          zarEquivalentCents: body.zarEquivalent === undefined && body.zarEquivalentZar === undefined && body.zarEquivalentCents === undefined ? undefined : cents(body.zarEquivalent || body.zarEquivalentZar || body.zarEquivalentCents / 100),
          fxRate: body.fxRate === undefined ? undefined : Number(body.fxRate),

          invoiceUrl: body.invoiceUrl === undefined ? undefined : text(body.invoiceUrl, 1200),
          invoiceObjectKey: body.invoiceObjectKey === undefined ? undefined : text(body.invoiceObjectKey, 1200),
          paymentMethod: body.paymentMethod === undefined ? undefined : text(body.paymentMethod, 80),
          paymentReference: body.paymentReference === undefined ? undefined : text(body.paymentReference, 240),
          proofOfPaymentUrl: body.proofOfPaymentUrl === undefined ? undefined : text(body.proofOfPaymentUrl, 1200),
          proofOfPaymentObjectKey: body.proofOfPaymentObjectKey === undefined ? undefined : text(body.proofOfPaymentObjectKey, 1200),

          orderDate: body.orderDate === undefined ? undefined : dateOrNull(body.orderDate),
          paymentDate: action === 'mark_import_order_paid' ? (dateOrNull(body.paymentDate) || new Date()) : body.paymentDate === undefined ? undefined : dateOrNull(body.paymentDate),
          expectedDeliveryDate: body.expectedDeliveryDate === undefined ? undefined : dateOrNull(body.expectedDeliveryDate),
          shippedAt: action === 'mark_import_order_shipped' ? (dateOrNull(body.shippedAt) || new Date()) : body.shippedAt === undefined ? undefined : dateOrNull(body.shippedAt),
          deliveredAt: body.deliveredAt === undefined ? undefined : dateOrNull(body.deliveredAt),
          receivedAt: action === 'receive_import_order' ? (dateOrNull(body.receivedAt) || new Date()) : body.receivedAt === undefined ? undefined : dateOrNull(body.receivedAt),
          inspectedAt:
            action === 'inspect_import_order' || action === 'accept_import_stock'
              ? (dateOrNull(body.inspectedAt) || new Date())
              : body.inspectedAt === undefined ? undefined : dateOrNull(body.inspectedAt),

          receivedByUserId:
            action === 'receive_import_order'
              ? access.envelope.actor.userId
              : body.receivedByUserId === undefined ? undefined : text(body.receivedByUserId, 180),
          inspectedByUserId:
            action === 'inspect_import_order' || action === 'accept_import_stock'
              ? access.envelope.actor.userId
              : body.inspectedByUserId === undefined ? undefined : text(body.inspectedByUserId, 180),

          qualityStatus:
            action === 'accept_import_stock'
              ? text(body.qualityStatus || 'accepted', 80)
              : body.qualityStatus === undefined ? undefined : text(body.qualityStatus, 80),
          inspectionNotes: body.inspectionNotes === undefined ? undefined : text(body.inspectionNotes, 4000),
          discrepancyNotes: body.discrepancyNotes === undefined ? undefined : text(body.discrepancyNotes, 4000),

          importDutyCents: landing.importDutyCents,
          taxCents: landing.taxCents,
          vatCents: landing.vatCents,
          mspCents: landing.mspCents,
          shippingCents: landing.shippingCents,
          clearingCents: landing.clearingCents,
          handlingCents: landing.handlingCents,
          otherLandingCostCents: landing.otherLandingCostCents,
          totalLandingCostCents: landing.totalLandingCostCents,
          landingCostPerUnitCents: landedCostPerUnit(landing.totalLandingCostCents, quantityForUnitCost),

          expenditureLedgerEntryId: body.expenditureLedgerEntryId === undefined ? undefined : text(body.expenditureLedgerEntryId, 180),
          vendorInvoiceId: body.vendorInvoiceId === undefined ? undefined : text(body.vendorInvoiceId, 180),
          stockMovementId: stockMovement?.id,
          stockPostedAt,

          approvedByUserId: action === 'approve_import_order' ? access.envelope.actor.userId : undefined,
          approvedAt: action === 'approve_import_order' ? new Date() : undefined,

          meta: body.meta === undefined ? undefined : asObject({
            ...(body.meta || {}),
            landedCostCalculated: true,
          }),
        }),
      });

      const auditAction =
        action === 'approve_import_order' ? 'import_order_approved' :
        action === 'mark_import_order_paid' ? 'import_order_marked_paid' :
        action === 'mark_import_order_shipped' ? 'import_order_marked_shipped' :
        action === 'receive_import_order' ? 'import_order_received' :
        action === 'inspect_import_order' ? 'import_order_inspected' :
        action === 'accept_import_stock' ? 'import_stock_accepted' :
        action === 'archive_import_order' ? 'import_order_archived' :
        action === 'void_import_order' ? 'import_order_voided' :
        'import_order_updated';

      await auditImportOrder(auditAction, req, importOrder.id, {
        status: importOrder.status,
        stockMovementId: stockMovement?.id || null,
        inventoryItemId: inventoryItem?.id || importOrder.inventoryItemId,
        quantityAccepted: importOrder.quantityAccepted,
        totalLandingCostCents: importOrder.totalLandingCostCents,
      });

      return json({ ok: true, envelope: access.envelope, importOrder, stockMovement, inventoryItem });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_import_order_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_import_order_patch_failed');
  }
}
