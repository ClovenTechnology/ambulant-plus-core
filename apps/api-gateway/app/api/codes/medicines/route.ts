// apps/api-gateway/app/api/codes/medicines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchMedicines } from '@ambulant/clinical-codes/medicine-catalog';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}


function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const next = clean(value, 300);
    if (next) return next;
  }
  return undefined;
}

async function searchGlobalProducts(q: string, limit: number) {
  const rows = await (prisma as any).carePortGlobalProduct.findMany({
    where: {
      catalogueStatus: { in: ['ACTIVE', 'PUBLISHED', 'APPROVED', 'VERIFIED'] },
      productType: { in: ['MEDICATION', 'OTC_MEDICATION'] },
      OR: [
        { canonicalName: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { primaryNappi: { contains: q, mode: 'insensitive' } },
        { primaryRxNorm: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ catalogueStatus: 'asc' }, { canonicalName: 'asc' }],
    take: Math.min(limit * 2, 100),
  }).catch(() => [] as any[]);

  return rows.map((row: any) => {
    const codes = [
      row.primaryNappi ? { system: 'nappi', code: row.primaryNappi, display: row.canonicalName } : null,
      row.primaryRxNorm ? { system: 'rxnorm', code: row.primaryRxNorm, display: row.canonicalName } : null,
      row.primaryGtin ? { system: 'gtin', code: row.primaryGtin, display: row.canonicalName } : null,
    ].filter(Boolean);

    return {
      id: row.id,
      label: row.canonicalName,
      name: row.canonicalName,
      genericName: row.brand ? undefined : row.canonicalName,
      brandName: row.brand || undefined,
      aliases: [row.brand, row.manufacturer, row.primaryNappi, row.primaryRxNorm].filter(Boolean),
      codes,
      source: 'careport_global_catalogue',
      country: 'ZA',
      prescriptionRequired: row.prescriptionRequired,
      strength: row.strength || undefined,
      doseForm: row.dosageForm || undefined,
      route: row.route || undefined,
      packSize: row.packSize || undefined,
      nappi: row.primaryNappi || undefined,
      rxnorm: row.primaryRxNorm || undefined,
      catalogueStatus: row.catalogueStatus,
      score: 100,
    };
  });
}

function codeSystemFor(code: string | null | undefined) {
  const c = clean(code, 120);
  if (!c) return 'local_sa';
  if (/^\d{5,12}$/.test(c)) return 'nappi';
  if (/^\d{3,12}$/.test(c)) return 'rxnorm';
  return 'local_sa';
}

async function searchActiveProviderMedicines(q: string, limit: number) {
  const rows = await (prisma as any).carePortPharmacySku.findMany({
    where: {
      isActive: true,
      pharmacy: {
        active: true,
      },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { drugCode: { contains: q, mode: 'insensitive' } },
        { skuCode: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: {
      pharmacy: {
        select: {
          id: true,
          name: true,
          city: true,
          active: true,
          commercialStatus: true,
          subscriptionStatus: true,
        },
      },
    },
    orderBy: [{ isGeneric: 'asc' }, { priceCents: 'asc' }, { name: 'asc' }],
    take: Math.min(limit * 3, 75),
  });

  const grouped = new Map<string, any>();

  for (const row of rows) {
    const code = clean(row.drugCode, 120);
    const key = (code || row.name).toLowerCase();
    const normalized = record(row.normalisedAttributes);
    const variant = record(row.variantAttributes);
    const attributes = record(row.attributes);
    const strength = firstText(normalized.strength, variant.strength, attributes.strength);
    const doseForm = firstText(
      normalized.dosageForm,
      normalized.form,
      variant.dosageForm,
      variant.form,
      attributes.dosageForm,
      attributes.form,
    );
    const route = firstText(normalized.route, variant.route, attributes.route);
    const system = codeSystemFor(code);
    const existing = grouped.get(key);

    const option = {
      pharmacyId: row.pharmacyId,
      pharmacyName: row.pharmacy?.name ?? null,
      skuId: row.id,
      skuCode: row.skuCode ?? null,
      priceCents: row.priceCents,
      currency: row.currency,
      isGeneric: row.isGeneric,
    };

    if (existing) {
      existing.providerCount += 1;
      existing.options.push(option);
      existing.minPriceCents = Math.min(existing.minPriceCents, row.priceCents);
      continue;
    }

    grouped.set(key, {
      id: code ? system + '-' + code : 'careport-sku-' + row.id,
      label: row.name,
      name: row.name,
      genericName: row.isGeneric ? row.name : undefined,
      brandName: row.isGeneric ? undefined : row.name,
      aliases: [row.skuCode, row.drugCode].filter(Boolean),
      codes: code ? [{ system, code, display: row.name }] : [{ system: 'local_sa', code: row.id, display: row.name }],
      source: 'careport_inventory',
      country: 'ZA',
      providerCount: 1,
      minPriceCents: row.priceCents,
      currency: row.currency,
      prescriptionRequired: true,
      strength,
      doseForm,
      route,
      packSize: row.packSize || undefined,
      nappi: system === 'nappi' ? code : undefined,
      rxnorm: system === 'rxnorm' ? code : undefined,
      options: [option],
      score: 50,
    });
  }

  return Array.from(grouped.values()).slice(0, limit);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const includeRxNorm = (searchParams.get('includeRxNorm') ?? '1') !== '0';

    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

    const [globalItems, providerItems] = await Promise.all([
      searchGlobalProducts(q, limit),
      searchActiveProviderMedicines(q, limit).catch((err) => {
        console.warn('[codes/medicines] provider catalogue search failed', err);
        return [];
      }),
    ]);

    const fallbackItems = await searchMedicines(q, { limit, includeRxNorm });
    const seen = new Set(
      [...globalItems, ...providerItems].map((item: any) =>
        String(item.codes?.[0]?.code || item.label).toLowerCase(),
      ),
    );

    const merged = [
      ...globalItems,
      ...providerItems.filter((item: any) => {
        const key = String(item.codes?.[0]?.code || item.label).toLowerCase();
        if (seen.has(key) && globalItems.some((global: any) => String(global.codes?.[0]?.code || global.label).toLowerCase() === key)) return false;
        return true;
      }),
      ...fallbackItems.filter((item: any) => {
        const key = String(item.codes?.[0]?.code || item.label).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ].slice(0, limit);

    return NextResponse.json({
      ok: true,
      items: merged,
      catalogue: {
        country: 'ZA',
        source: globalItems.length
          ? 'careport_global_catalogue_plus_inventory_plus_rxnorm'
          : providerItems.length
            ? 'careport_inventory_plus_seed'
            : 'local_sa_seed_plus_rxnorm',
        globalCatalogueBacked: globalItems.length > 0,
        providerBacked: providerItems.length > 0,
        nappiComplete: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'medicine_search_failed', items: [] },
      { status: 500 },
    );
  }
}
