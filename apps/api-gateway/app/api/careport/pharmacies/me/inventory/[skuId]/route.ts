//apps/api-gateway/app/api/careport/pharmacies/me/inventory/[skuId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'active'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(raw)) return false;
  return fallback;
}

function asPriceCents(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = clean(value, 40).replace(/[^0-9.\-]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return raw.includes('.') ? Math.max(0, Math.round(n * 100)) : Math.max(0, Math.round(n));
}


const CAREPORT_PRODUCT_TYPES = new Set([
  'MEDICATION',
  'OTC_MEDICATION',
  'SUPPLEMENT',
  'MEDICAL_DEVICE',
  'PERSONAL_CARE',
  'SKINCARE',
  'HAIRCARE',
  'BABY_CARE',
  'HOUSEHOLD',
  'GENERAL_MERCHANDISE',
]);

function careportCleanToken(value: unknown, fallback = '') {
  const raw = clean(value, 80)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return raw || fallback;
}

function careportOptionalInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function careportJsonObject(value: unknown): Record<string, any> | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeCarePortProductType(value: unknown, fallback = 'MEDICATION') {
  const token = careportCleanToken(value, fallback);

  if (CAREPORT_PRODUCT_TYPES.has(token)) return token;
  if (['OTC', 'OVER_THE_COUNTER', 'NON_PRESCRIPTION_MEDICATION'].includes(token)) return 'OTC_MEDICATION';
  if (['VITAMIN', 'VITAMINS', 'MULTIVITAMIN', 'SUPPLEMENTS'].includes(token)) return 'SUPPLEMENT';
  if (['DEVICE', 'MEDICAL_DEVICES'].includes(token)) return 'MEDICAL_DEVICE';
  if (['MERCHANDISE', 'GENERAL', 'RETAIL', 'OTHER'].includes(token)) return 'GENERAL_MERCHANDISE';

  return fallback;
}

function normalizeCarePortExtendedSkuInput(body: any) {
  const productType = normalizeCarePortProductType(body?.productType ?? body?.type ?? body?.itemType, 'MEDICATION');
  const otc = asBool(body?.otc ?? body?.isOtc ?? body?.overTheCounter, productType === 'OTC_MEDICATION');

  const prescriptionRequired = asBool(
    body?.prescriptionRequired ?? body?.requiresPrescription ?? body?.rxRequired,
    productType === 'MEDICATION' && !otc,
  );

  return {
    productType,
    category: clean(body?.category ?? body?.department, 120) || null,
    subcategory: clean(body?.subcategory ?? body?.subCategory, 120) || null,
    otc,
    prescriptionRequired,
    marketplaceVisible: asBool(body?.marketplaceVisible ?? body?.visibleInMarketplace ?? body?.public, !prescriptionRequired),
    sellableOnline: asBool(body?.sellableOnline ?? body?.onlineSale ?? body?.canBuyOnline, true),
    brand: clean(body?.brand, 160) || null,
    manufacturer: clean(body?.manufacturer ?? body?.supplier, 160) || null,
    barcode: clean(body?.barcode ?? body?.gtin ?? body?.ean ?? body?.upc, 120) || null,
    description: clean(body?.description ?? body?.details, 2000) || null,
    imageUrl: clean(body?.imageUrl ?? body?.image ?? body?.photoUrl, 1000) || null,
    packSize: clean(body?.packSize ?? body?.pack ?? body?.size, 120) || null,
    variantGroupKey: clean(body?.variantGroupKey ?? body?.parentSku ?? body?.styleCode, 160) || null,
    variantName: clean(body?.variantName ?? body?.variant ?? body?.optionName, 160) || null,
    variantAttributes: careportJsonObject(body?.variantAttributes ?? body?.variants ?? body?.options),
    attributes: careportJsonObject(body?.attributes ?? body?.metadata),
    stockOnHand: careportOptionalInt(body?.stockOnHand ?? body?.stock ?? body?.quantityOnHand),
    reservedStock: careportOptionalInt(body?.reservedStock) ?? 0,
    lowStockThreshold: careportOptionalInt(body?.lowStockThreshold ?? body?.reorderLevel),
    maxOrderQty: careportOptionalInt(body?.maxOrderQty ?? body?.maxQuantity),
    ageRestricted: asBool(body?.ageRestricted ?? body?.adultOnly, false),
    regulatedSchedule: clean(body?.regulatedSchedule ?? body?.schedule ?? body?.medicineSchedule, 80) || null,
    taxCategory: clean(body?.taxCategory ?? body?.vatCategory, 80) || null,
  };
}

function normalizeCarePortExtendedSkuPatch(body: any) {
  const data: Record<string, any> = {};

  if (body.productType !== undefined || body.type !== undefined || body.itemType !== undefined) {
    data.productType = normalizeCarePortProductType(body.productType ?? body.type ?? body.itemType, 'MEDICATION');
  }

  if (body.category !== undefined || body.department !== undefined) data.category = clean(body.category ?? body.department, 120) || null;
  if (body.subcategory !== undefined || body.subCategory !== undefined) data.subcategory = clean(body.subcategory ?? body.subCategory, 120) || null;
  if (body.otc !== undefined || body.isOtc !== undefined || body.overTheCounter !== undefined) data.otc = asBool(body.otc ?? body.isOtc ?? body.overTheCounter, false);
  if (body.prescriptionRequired !== undefined || body.requiresPrescription !== undefined || body.rxRequired !== undefined) data.prescriptionRequired = asBool(body.prescriptionRequired ?? body.requiresPrescription ?? body.rxRequired, true);
  if (body.marketplaceVisible !== undefined || body.visibleInMarketplace !== undefined || body.public !== undefined) data.marketplaceVisible = asBool(body.marketplaceVisible ?? body.visibleInMarketplace ?? body.public, false);
  if (body.sellableOnline !== undefined || body.onlineSale !== undefined || body.canBuyOnline !== undefined) data.sellableOnline = asBool(body.sellableOnline ?? body.onlineSale ?? body.canBuyOnline, true);
  if (body.brand !== undefined) data.brand = clean(body.brand, 160) || null;
  if (body.manufacturer !== undefined || body.supplier !== undefined) data.manufacturer = clean(body.manufacturer ?? body.supplier, 160) || null;
  if (body.barcode !== undefined || body.gtin !== undefined || body.ean !== undefined || body.upc !== undefined) data.barcode = clean(body.barcode ?? body.gtin ?? body.ean ?? body.upc, 120) || null;
  if (body.description !== undefined || body.details !== undefined) data.description = clean(body.description ?? body.details, 2000) || null;
  if (body.imageUrl !== undefined || body.image !== undefined || body.photoUrl !== undefined) data.imageUrl = clean(body.imageUrl ?? body.image ?? body.photoUrl, 1000) || null;
  if (body.packSize !== undefined || body.pack !== undefined || body.size !== undefined) data.packSize = clean(body.packSize ?? body.pack ?? body.size, 120) || null;
  if (body.variantGroupKey !== undefined || body.parentSku !== undefined || body.styleCode !== undefined) data.variantGroupKey = clean(body.variantGroupKey ?? body.parentSku ?? body.styleCode, 160) || null;
  if (body.variantName !== undefined || body.variant !== undefined || body.optionName !== undefined) data.variantName = clean(body.variantName ?? body.variant ?? body.optionName, 160) || null;
  if (body.variantAttributes !== undefined || body.variants !== undefined || body.options !== undefined) data.variantAttributes = careportJsonObject(body.variantAttributes ?? body.variants ?? body.options);
  if (body.attributes !== undefined || body.metadata !== undefined) data.attributes = careportJsonObject(body.attributes ?? body.metadata);
  if (body.stockOnHand !== undefined || body.stock !== undefined || body.quantityOnHand !== undefined) data.stockOnHand = careportOptionalInt(body.stockOnHand ?? body.stock ?? body.quantityOnHand);
  if (body.reservedStock !== undefined) data.reservedStock = careportOptionalInt(body.reservedStock) ?? 0;
  if (body.lowStockThreshold !== undefined || body.reorderLevel !== undefined) data.lowStockThreshold = careportOptionalInt(body.lowStockThreshold ?? body.reorderLevel);
  if (body.maxOrderQty !== undefined || body.maxQuantity !== undefined) data.maxOrderQty = careportOptionalInt(body.maxOrderQty ?? body.maxQuantity);
  if (body.ageRestricted !== undefined || body.adultOnly !== undefined) data.ageRestricted = asBool(body.ageRestricted ?? body.adultOnly, false);
  if (body.regulatedSchedule !== undefined || body.schedule !== undefined || body.medicineSchedule !== undefined) data.regulatedSchedule = clean(body.regulatedSchedule ?? body.schedule ?? body.medicineSchedule, 80) || null;
  if (body.taxCategory !== undefined || body.vatCategory !== undefined) data.taxCategory = clean(body.taxCategory ?? body.vatCategory, 80) || null;

  return data;
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);

  if (who.role === 'admin' && explicit) return explicit;
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);

  if (who.role === 'pharmacy_staff' && who.uid) {
    const mapped = await pharmacyIdForStaff(orgId, who.uid);
    return mapped ? String(mapped) : null;
  }

  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { skuId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const skuId = clean(params.skuId, 120);
    if (!skuId) return json({ ok: false, error: 'skuId_required' }, 400);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body.name !== undefined) data.name = clean(body.name, 500);
    if (body.skuCode !== undefined || body.sku !== undefined || body.localSku !== undefined) {
      data.skuCode = clean(body.skuCode ?? body.sku ?? body.localSku, 120) || null;
    }
    if (
      body.drugCode !== undefined ||
      body.code !== undefined ||
      body.nappiCode !== undefined ||
      body.nappi !== undefined ||
      body.rxnormCode !== undefined ||
      body.rxCui !== undefined ||
      body.rxcui !== undefined
    ) {
      data.drugCode = clean(
        body.nappiCode ?? body.nappi ?? body.rxnormCode ?? body.rxCui ?? body.rxcui ?? body.drugCode ?? body.code,
        120,
      ) || null;
    }

    if (body.priceCents !== undefined || body.price !== undefined) {
      const price = asPriceCents(body.priceCents ?? body.price);
      if (price == null) return json({ ok: false, error: 'invalid_price' }, 400);
      data.priceCents = price;
    }

    if (body.currency !== undefined) data.currency = clean(body.currency, 10).toUpperCase();
    if (body.isGeneric !== undefined || body.generic !== undefined) data.isGeneric = asBool(body.isGeneric ?? body.generic, false);
    if (body.isActive !== undefined || body.active !== undefined) data.isActive = asBool(body.isActive ?? body.active, true);
    Object.assign(data, normalizeCarePortExtendedSkuPatch(body));

    if (data.name !== undefined && !data.name) return json({ ok: false, error: 'name_required' }, 400);
    if (Object.keys(data).length === 0) return json({ ok: false, error: 'no_update_fields' }, 400);

    const existing = await (prisma as any).carePortPharmacySku.findFirst({ where: { id: skuId, orgId, pharmacyId } });
    if (!existing) return json({ ok: false, error: 'sku_not_found' }, 404);

    if (data.currency && data.currency !== existing.currency) {
      const pharmacy = await (prisma as any).pharmacyPartner.findUnique({ where: { id: pharmacyId } });
      if (pharmacy?.currency && data.currency !== pharmacy.currency) {
        return json({ ok: false, error: 'currency_must_match_pharmacy_currency', pharmacyCurrency: pharmacy.currency }, 409);
      }
    }

    const updated = await (prisma as any).carePortPharmacySku.update({ where: { id: skuId }, data });

    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_inventory_sku_updated',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: skuId,
        meta: { orgId, pharmacyId, changed: Object.keys(data) },
      },
    }).catch(() => null);

    return json({ ok: true, item: updated, sku: updated });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_update_failed' }, error?.status || 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { skuId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const skuId = clean(params.skuId, 120);
    if (!skuId) return json({ ok: false, error: 'skuId_required' }, 400);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const existing = await (prisma as any).carePortPharmacySku.findFirst({ where: { id: skuId, orgId, pharmacyId } });
    if (!existing) return json({ ok: false, error: 'sku_not_found' }, 404);

    const updated = await (prisma as any).carePortPharmacySku.update({ where: { id: skuId }, data: { isActive: false } });

    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_inventory_sku_deactivated',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: skuId,
        meta: { orgId, pharmacyId },
      },
    }).catch(() => null);

    return json({ ok: true, item: updated, sku: updated });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_delete_failed' }, error?.status || 500);
  }
}
