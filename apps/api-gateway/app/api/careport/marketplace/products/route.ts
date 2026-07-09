import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { orgIdFromHeaders } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRUSTED_SKU_NORMALISATION_STATUSES = [
  'MAPPED_TO_TEMPLATE',
  'ADMIN_VERIFIED',
  'GLOBAL_CATALOGUE_MATCHED',
];

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function asPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
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

function availableStock(sku: any) {
  if (typeof sku?.stockOnHand !== 'number') return null;
  return Math.max(0, Number(sku.stockOnHand || 0) - Number(sku.reservedStock || 0));
}

function productTypeLabel(value: unknown) {
  return clean(value, 80)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildSkuWhere(req: NextRequest, orgId: string) {
  const url = new URL(req.url);
  const q = clean(url.searchParams.get('q'), 160);
  const productType = clean(url.searchParams.get('productType'), 80).toUpperCase();
  const category = clean(url.searchParams.get('category'), 120);

  const where: any = {
    orgId,
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
  };

  if (productType && productType !== 'ALL') {
    where.productType = productType;
  }

  if (category && category !== 'ALL') {
    where.category = { equals: category, mode: 'insensitive' };
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { canonicalName: { contains: q, mode: 'insensitive' } },
      { globalProductKey: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } },
      { manufacturer: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
      { drugCode: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { subcategory: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
}

function normaliseItem(sku: any, globalProduct: any) {
  const stockAvailable = availableStock(sku);

  return {
    id: sku.id,
    skuId: sku.id,
    pharmacyId: sku.pharmacyId,
    pharmacyName: sku.pharmacy?.name ?? null,
    pharmacyCity: sku.pharmacy?.city ?? null,
    pharmacyAddress: sku.pharmacy?.address ?? null,
    supportsPickup: Boolean(sku.pharmacy?.supportsPickup),
    supportsDelivery: Boolean(sku.pharmacy?.supportsDelivery),

    globalProductId: sku.globalProductId,
    globalProductKey: sku.globalProductKey,
    canonicalName: globalProduct?.canonicalName || sku.canonicalName || sku.name,
    displayName: sku.name,
    productType: sku.productType,
    productTypeLabel: productTypeLabel(sku.productType),
    category: sku.category,
    subcategory: sku.subcategory,

    otc: Boolean(sku.otc),
    prescriptionRequired: false,
    marketplaceVisible: true,
    sellableOnline: true,

    brand: sku.brand,
    manufacturer: sku.manufacturer,
    description: sku.description || globalProduct?.description || null,
    imageUrl: sku.imageUrl || globalProduct?.imageUrl || null,
    packSize: sku.packSize || globalProduct?.packSize || null,
    variantName: sku.variantName,
    variantGroupKey: sku.variantGroupKey,
    variantAttributes: sku.variantAttributes,
    attributes: sku.attributes,

    priceCents: sku.priceCents,
    currency: sku.currency || 'ZAR',
    stockOnHand: sku.stockOnHand,
    reservedStock: sku.reservedStock,
    availableStock: stockAvailable,
    maxOrderQty: sku.maxOrderQty,
    ageRestricted: Boolean(sku.ageRestricted),
    regulatedSchedule: sku.regulatedSchedule,

    barcode: sku.barcode,
    primaryBarcode: globalProduct?.primaryBarcode || sku.barcode || null,
    primaryNappi: globalProduct?.primaryNappi || null,
    primaryRxNorm: globalProduct?.primaryRxNorm || null,
    primaryGtin: globalProduct?.primaryGtin || null,

    catalogueStatus: globalProduct?.catalogueStatus || null,
    normalisationStatus: sku.normalisationStatus,
    normalisationConfidence: sku.normalisationConfidence,
    updatedAt: sku.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const orgId = orgIdFromHeaders(req.headers);
    const url = new URL(req.url);
    const limit = asPositiveInt(url.searchParams.get('limit'), 60, 120);
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    const where = buildSkuWhere(req, orgId);

    const rows = await (prisma as any).carePortPharmacySku.findMany({
      where,
      orderBy: [
        { updatedAt: 'desc' },
        { name: 'asc' },
      ],
      skip: offset,
      take: limit,
      select: {
        id: true,
        orgId: true,
        pharmacyId: true,
        name: true,
        drugCode: true,
        skuCode: true,
        isGeneric: true,
        productType: true,
        category: true,
        subcategory: true,
        otc: true,
        prescriptionRequired: true,
        marketplaceVisible: true,
        sellableOnline: true,
        brand: true,
        manufacturer: true,
        barcode: true,
        description: true,
        imageUrl: true,
        packSize: true,
        variantGroupKey: true,
        variantName: true,
        variantAttributes: true,
        attributes: true,
        stockOnHand: true,
        reservedStock: true,
        maxOrderQty: true,
        ageRestricted: true,
        regulatedSchedule: true,
        priceCents: true,
        currency: true,
        isActive: true,
        normalisationStatus: true,
        normalisationConfidence: true,
        globalProductKey: true,
        globalProductId: true,
        canonicalName: true,
        reviewRequired: true,
        updatedAt: true,
        pharmacy: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            active: true,
            supportsPickup: true,
            supportsDelivery: true,
          },
        },
      },
    });

    const skus = rows.filter((sku: any) => {
      const stockAvailable = availableStock(sku);
      return stockAvailable == null || stockAvailable > 0;
    });

    const globalProductIds = Array.from(
      new Set(
        skus
          .map((sku: any) => clean(sku.globalProductId, 191))
          .filter(Boolean),
      ),
    );

    const globalProducts = globalProductIds.length
      ? await (prisma as any).carePortGlobalProduct.findMany({
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
            globalProductKey: true,
            canonicalName: true,
            productType: true,
            category: true,
            subcategory: true,
            otc: true,
            prescriptionRequired: true,
            marketplaceAllowed: true,
            sellableOnline: true,
            brand: true,
            manufacturer: true,
            description: true,
            imageUrl: true,
            packSize: true,
            dosageForm: true,
            strength: true,
            route: true,
            primaryBarcode: true,
            primaryNappi: true,
            primaryRxNorm: true,
            primaryGtin: true,
            catalogueStatus: true,
          },
        })
      : [];

    const globalById = new Map(globalProducts.map((item: any) => [item.id, item]));

    const items = skus
      .map((sku: any) => {
        const globalProduct = globalById.get(sku.globalProductId);
        return globalProduct ? normaliseItem(sku, globalProduct) : null;
      })
      .filter(Boolean);

    const categories = Array.from(
      new Set(items.map((item: any) => clean(item.category, 120)).filter(Boolean)),
    ).sort();

    const productTypes = Array.from(
      new Set(items.map((item: any) => clean(item.productType, 80)).filter(Boolean)),
    ).sort();

    return json({
      ok: true,
      orgId,
      total: items.length,
      limit,
      offset,
      items,
      facets: {
        categories,
        productTypes,
      },
      rules: {
        prescriptionRequiredBlocked: true,
        requiresTrustedSkuNormalisation: true,
        requiresGlobalProductApproval: true,
        requiresActivePharmacy: true,
      },
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || 'careport_marketplace_products_failed',
      },
      error?.status || 500,
    );
  }
}