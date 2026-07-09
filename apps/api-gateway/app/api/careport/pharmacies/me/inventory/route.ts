import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';
import { normaliseCarePortSkuForCatalogue } from '@/src/careport/catalogue/normalisation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'active', 'available'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'inactive', 'unavailable'].includes(raw)) return false;
  return fallback;
}

function asPriceCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = clean(value, 40).replace(/[^0-9.\-]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.includes('.') ? Math.max(0, Math.round(n * 100)) : Math.max(0, Math.round(n));
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value, 160);
    if (s) return s;
  }
  return '';
}

function parseSkuCodes(body: any) {
  const skuCode = firstString(
    body?.skuCode,
    body?.sku_code,
    body?.sku,
    body?.pharmacySku,
    body?.pharmacy_sku,
    body?.localSku,
    body?.local_sku,
    body?.stockCode,
    body?.stock_code,
    body?.productCode,
    body?.product_code,
  ) || null;

  const nappiCode = firstString(body?.nappiCode, body?.nappi_code, body?.nappi);
  const rxnormCode = firstString(body?.rxnormCode, body?.rxnorm_code, body?.rxCui, body?.rxcui, body?.rxnorm);
  const explicitDrugCode = firstString(body?.drugCode, body?.drug_code, body?.code, body?.medicineCode, body?.medicine_code);

  const drugCode = nappiCode || rxnormCode || explicitDrugCode || null;
  const codeSystem = nappiCode ? 'NAPPI' : rxnormCode ? 'RXNORM' : drugCode ? 'LOCAL_OR_UNKNOWN' : null;

  return { skuCode, drugCode, codeSystem };
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
    headers: {
      'Cache-Control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function normalizeSkuInput(body: any, pharmacyCurrency = 'ZAR') {
  const name = clean(body?.name ?? body?.displayName ?? body?.drugName ?? body?.medication ?? body?.label, 500);
  const { skuCode, drugCode, codeSystem } = parseSkuCodes(body);
  const currency = clean(body?.currency, 10).toUpperCase() || pharmacyCurrency || 'ZAR';
  const priceCents = asPriceCents(body?.priceCents ?? body?.price ?? body?.unitPriceCents ?? body?.unitPrice);

  return {
    name,
    skuCode,
    drugCode,
    codeSystem,
    priceCents,
    currency,
    isGeneric: asBool(body?.isGeneric ?? body?.generic, false),
    isActive: asBool(body?.isActive ?? body?.active, true),
  };
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

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved', items: [] }, 409);

    const q = clean(req.nextUrl.searchParams.get('q'), 120);
    const active = clean(req.nextUrl.searchParams.get('active'), 20).toLowerCase();
    const generic = clean(req.nextUrl.searchParams.get('generic'), 20).toLowerCase();
    const productType = clean(req.nextUrl.searchParams.get('productType') ?? req.nextUrl.searchParams.get('type'), 80);
    const category = clean(req.nextUrl.searchParams.get('category'), 120);
    const subcategory = clean(req.nextUrl.searchParams.get('subcategory') ?? req.nextUrl.searchParams.get('subCategory'), 120);
    const otc = clean(req.nextUrl.searchParams.get('otc') ?? req.nextUrl.searchParams.get('isOtc'), 20).toLowerCase();
    const marketplace = clean(req.nextUrl.searchParams.get('marketplaceVisible') ?? req.nextUrl.searchParams.get('marketplace'), 20).toLowerCase();
    const prescriptionRequired = clean(req.nextUrl.searchParams.get('prescriptionRequired') ?? req.nextUrl.searchParams.get('rxRequired'), 20).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 200)));

    const where: any = { orgId, pharmacyId };

    if (active === 'true' || active === '1') where.isActive = true;
    if (active === 'false' || active === '0') where.isActive = false;
    if (generic === 'true' || generic === '1') where.isGeneric = true;
    if (generic === 'false' || generic === '0') where.isGeneric = false;
    if (productType) where.productType = normalizeCarePortProductType(productType, 'MEDICATION');
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (subcategory) where.subcategory = { equals: subcategory, mode: 'insensitive' };
    if (otc === 'true' || otc === '1') where.otc = true;
    if (otc === 'false' || otc === '0') where.otc = false;
    if (marketplace === 'true' || marketplace === '1') where.marketplaceVisible = true;
    if (marketplace === 'false' || marketplace === '0') where.marketplaceVisible = false;
    if (prescriptionRequired === 'true' || prescriptionRequired === '1') where.prescriptionRequired = true;
    if (prescriptionRequired === 'false' || prescriptionRequired === '0') where.prescriptionRequired = false;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { drugCode: { contains: q, mode: 'insensitive' } },
        { skuCode: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { subcategory: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await (prisma as any).carePortPharmacySku.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { isGeneric: 'asc' }, { name: 'asc' }],
      take: limit,
    });

    return json({ ok: true, pharmacyId, items, inventory: items });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_load_failed', items: [] }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const pharmacy = await (prisma as any).pharmacyPartner.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) return json({ ok: false, error: 'pharmacy_not_found' }, 404);
    if (pharmacy.active === false) return json({ ok: false, error: 'pharmacy_inactive' }, 409);

    const body = await req.json().catch(() => ({}));
    const input = normalizeSkuInput(body, pharmacy.currency || 'ZAR');
    const extended = normalizeCarePortExtendedSkuInput(body);
    const catalogueGovernance = normaliseCarePortSkuForCatalogue(
      { ...input, ...extended },
      'PHARMACY_SUPPLIED',
    );

    if (!input.name) return json({ ok: false, error: 'name_required' }, 400);
    if (!input.priceCents || input.priceCents < 0) return json({ ok: false, error: 'valid_price_required' }, 400);

    if (pharmacy.currency && input.currency !== pharmacy.currency) {
      return json({ ok: false, error: 'currency_must_match_pharmacy_currency', pharmacyCurrency: pharmacy.currency }, 409);
    }

    const duplicateWhere: any[] = [];
    if (input.skuCode) duplicateWhere.push({ skuCode: input.skuCode });
    if (extended.barcode) duplicateWhere.push({ barcode: extended.barcode });
    if (input.drugCode) duplicateWhere.push({ drugCode: input.drugCode, name: { equals: input.name, mode: 'insensitive' } });

    const existing = duplicateWhere.length
      ? await (prisma as any).carePortPharmacySku.findFirst({
          where: { orgId, pharmacyId, OR: duplicateWhere },
          orderBy: { updatedAt: 'desc' },
        })
      : null;

    const data = {
      orgId,
      pharmacyId,
      name: input.name,
      skuCode: input.skuCode,
      drugCode: input.drugCode,
      priceCents: input.priceCents,
      currency: input.currency,
      isGeneric: input.isGeneric,
      isActive: input.isActive,
      ...extended,
      ...catalogueGovernance,
    };

    const item = existing
      ? await (prisma as any).carePortPharmacySku.update({ where: { id: existing.id }, data })
      : await (prisma as any).carePortPharmacySku.create({ data });

    await (prisma as any).auditEvent.create({
      data: {
        kind: existing ? 'careport_inventory_sku_upsert_updated' : 'careport_inventory_sku_created',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: item.id,
        meta: {
          orgId,
          pharmacyId,
          name: input.name,
          skuCode: input.skuCode,
          drugCode: input.drugCode,
          codeSystem: input.codeSystem,
          isGeneric: input.isGeneric,
          duplicateMatched: Boolean(existing),
          catalogueSource: catalogueGovernance.catalogueSource,
          normalisationStatus: catalogueGovernance.normalisationStatus,
          reviewRequired: catalogueGovernance.reviewRequired,
          reviewReason: catalogueGovernance.reviewReason,
        },
      },
    }).catch(() => null);

    return json({ ok: true, item, sku: item, updatedExisting: Boolean(existing) }, existing ? 200 : 201);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_create_failed' }, error?.status || 500);
  }
}
