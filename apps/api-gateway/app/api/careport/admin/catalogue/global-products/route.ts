import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForCarePortCatalogue = globalThis as unknown as {
  carePortCataloguePrisma?: PrismaClient;
};

const prisma =
  globalForCarePortCatalogue.carePortCataloguePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForCarePortCatalogue.carePortCataloguePrisma = prisma;
}

function asPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function buildSearchWhere(params: {
  q: string;
  status: string;
  productType: string;
}) {
  const where: Record<string, unknown> = {};

  if (params.q) {
    where.OR = [
      { canonicalName: { contains: params.q, mode: 'insensitive' } },
      { globalProductKey: { contains: params.q, mode: 'insensitive' } },
      { primaryBarcode: { contains: params.q, mode: 'insensitive' } },
      { primaryNappi: { contains: params.q, mode: 'insensitive' } },
      { primaryRxNorm: { contains: params.q, mode: 'insensitive' } },
      { primaryGtin: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  if (params.status) where.catalogueStatus = params.status;
  if (params.productType) where.productType = params.productType;

  return where;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const status = (url.searchParams.get('status') || '').trim().toUpperCase();
    const productType = (url.searchParams.get('productType') || '').trim().toUpperCase();
    const limit = asPositiveInt(url.searchParams.get('limit'), 50, 200);
    const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    const where = buildSearchWhere({ q, status, productType });

    const [
      total,
      items,
      activeCount,
      draftCount,
      reviewCount,
      rejectedCount,
      medicationCount,
      otcCount,
      merchandiseCount,
    ] = await prisma.$transaction([
      prisma.carePortGlobalProduct.count({ where }),
      prisma.carePortGlobalProduct.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { canonicalName: 'asc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          orgId: true,
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
          packSize: true,
          dosageForm: true,
          strength: true,
          route: true,
          regulatedSchedule: true,
          primaryBarcode: true,
          primaryNappi: true,
          primaryRxNorm: true,
          primaryGtin: true,
          catalogueStatus: true,
          catalogueSource: true,
          confidence: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.carePortGlobalProduct.count({ where: { catalogueStatus: 'ACTIVE' } }),
      prisma.carePortGlobalProduct.count({ where: { catalogueStatus: 'DRAFT' } }),
      prisma.carePortGlobalProduct.count({ where: { catalogueStatus: 'NEEDS_REVIEW' } }),
      prisma.carePortGlobalProduct.count({ where: { catalogueStatus: 'REJECTED' } }),
      prisma.carePortGlobalProduct.count({ where: { productType: 'MEDICATION' } }),
      prisma.carePortGlobalProduct.count({ where: { productType: 'OTC' } }),
      prisma.carePortGlobalProduct.count({ where: { productType: 'MERCHANDISE' } }),
    ]);

    return NextResponse.json({
      ok: true,
      total,
      limit,
      offset,
      items,
      facets: {
        byStatus: [
          { catalogueStatus: 'ACTIVE', _count: { _all: activeCount } },
          { catalogueStatus: 'DRAFT', _count: { _all: draftCount } },
          { catalogueStatus: 'NEEDS_REVIEW', _count: { _all: reviewCount } },
          { catalogueStatus: 'REJECTED', _count: { _all: rejectedCount } },
        ],
        byProductType: [
          { productType: 'MEDICATION', _count: { _all: medicationCount } },
          { productType: 'OTC', _count: { _all: otcCount } },
          { productType: 'MERCHANDISE', _count: { _all: merchandiseCount } },
        ],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to load CarePort global products.',
      },
      { status: 500 },
    );
  }
}
