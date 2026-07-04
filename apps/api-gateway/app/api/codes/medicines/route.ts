// apps/api-gateway/app/api/codes/medicines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchMedicines } from '@ambulant/clinical-codes/medicine-catalog';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
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

    const providerItems = await searchActiveProviderMedicines(q, limit).catch((err) => {
      console.warn('[codes/medicines] provider catalogue search failed', err);
      return [];
    });

    const fallbackItems = await searchMedicines(q, { limit, includeRxNorm });
    const seen = new Set(providerItems.map((item: any) => String(item.codes?.[0]?.code || item.label).toLowerCase()));

    const merged = [
      ...providerItems,
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
        source: providerItems.length ? 'careport_inventory_plus_seed' : 'local_sa_seed_plus_rxnorm',
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
