// apps/api-gateway/app/api/codes/labs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchLabTests } from '@ambulant/clinical-codes/lab-catalog';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

async function searchActiveProviderLabTests(q: string, limit: number) {
  const rows = await (prisma as any).medReachLabOfferedTest.findMany({
    where: {
      active: true,
      lab: {
        active: true,
      },
      OR: [
        { localName: { contains: q, mode: 'insensitive' } },
        { localCode: { contains: q, mode: 'insensitive' } },
        { specimenType: { contains: q, mode: 'insensitive' } },
        { catalogTest: { name: { contains: q, mode: 'insensitive' } } },
        { catalogTest: { code: { contains: q, mode: 'insensitive' } } },
        { catalogTest: { loincCode: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: {
      lab: {
        select: {
          id: true,
          name: true,
          active: true,
          status: true,
          country: true,
          currency: true,
        },
      },
      catalogTest: true,
    },
    orderBy: [{ priceCents: 'asc' }, { localName: 'asc' }],
    take: Math.min(limit * 3, 75),
  });

  const grouped = new Map<string, any>();

  for (const row of rows) {
    const catalog = row.catalogTest;
    const code = clean(catalog?.code || row.localCode || row.id, 120);
    const key = code.toLowerCase();
    const existing = grouped.get(key);

    const option = {
      labId: row.labId,
      labName: row.lab?.name ?? null,
      offeredTestId: row.id,
      localCode: row.localCode,
      priceCents: row.priceCents,
      currency: row.currency,
      turnaroundHours: row.turnaroundHours,
      active: row.active,
    };

    if (existing) {
      existing.providerCount += 1;
      existing.options.push(option);
      existing.minPriceCents = Math.min(existing.minPriceCents, row.priceCents);
      existing.turnaroundHours = Math.min(existing.turnaroundHours, row.turnaroundHours);
      continue;
    }

    grouped.set(key, {
      id: catalog?.id || row.id,
      code,
      codeSystem: catalog?.loincCode ? 'loinc' : 'local_sa_lab_catalog',
      name: catalog?.name || row.localName,
      label: catalog?.name || row.localName,
      aliases: [row.localName, row.localCode, catalog?.loincCode].filter(Boolean),
      category: catalog?.category || 'General',
      specimen: row.specimenType || catalog?.specimenTypeDefault || null,
      source: 'medreach_provider_catalogue',
      country: 'ZA',
      providerCount: 1,
      minPriceCents: row.priceCents,
      currency: row.currency,
      turnaroundHours: row.turnaroundHours,
      requiresColdChain: row.requiresColdChain,
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

    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

    const providerItems = await searchActiveProviderLabTests(q, limit).catch((err) => {
      console.warn('[codes/labs] provider catalogue search failed', err);
      return [];
    });

    const fallbackItems = searchLabTests(q, { limit });
    const seen = new Set(providerItems.map((item: any) => String(item.code || item.name).toLowerCase()));

    const merged = [
      ...providerItems,
      ...fallbackItems.filter((item: any) => {
        const key = String(item.code || item.name).toLowerCase();
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
        source: providerItems.length ? 'medreach_provider_catalogue_plus_seed' : 'local_sa_lab_seed',
        providerBacked: providerItems.length > 0,
        providerComplete: providerItems.length > 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'lab_search_failed', items: [] },
      { status: 500 },
    );
  }
}
