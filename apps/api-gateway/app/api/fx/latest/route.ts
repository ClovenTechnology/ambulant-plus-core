// apps/api-gateway/app/api/fx/latest/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { csvQuotes, isCcy, normCcy, toNumberDecimal } from '../_shared';

type RateOut = { rate: number; asOf?: string; source?: 'manual' | 'auto'; derived?: boolean };

async function loadDirect(base: string, quotes: string[]) {
  const wantAll = quotes.length === 0;

  const whereBase = { base, status: 'active' as const };
  const manual = await prisma.fxRate.findMany({
    where: {
      ...whereBase,
      ...(wantAll ? {} : { quote: { in: quotes } }),
      source: 'manual',
    },
    orderBy: [{ quote: 'asc' }, { asOf: 'desc' }],
  });

  const seen = new Set<string>();
  const pick: Record<string, { rate: number; asOf: string; source: 'manual' }> = {};

  for (const r of manual) {
    if (seen.has(r.quote)) continue;
    seen.add(r.quote);
    pick[r.quote] = { rate: toNumberDecimal(r.rate), asOf: r.asOf.toISOString(), source: 'manual' };
  }

  const missing = wantAll ? [] : quotes.filter((q) => !seen.has(q));
  if (wantAll || missing.length) {
    const auto = await prisma.fxRate.findMany({
      where: {
        ...whereBase,
        ...(wantAll ? {} : { quote: { in: missing } }),
        source: 'auto',
      },
      orderBy: [{ quote: 'asc' }, { asOf: 'desc' }],
    });

    for (const r of auto) {
      if (seen.has(r.quote)) continue;
      seen.add(r.quote);
      pick[r.quote] = { rate: toNumberDecimal(r.rate), asOf: r.asOf.toISOString(), source: 'auto' as any };
    }
  }

  return pick;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const base = normCcy(url.searchParams.get('base') || 'USD');
    if (!isCcy(base)) {
      return NextResponse.json({ ok: false, error: 'Invalid base currency' }, { status: 400 });
    }

    const quotes = csvQuotes(url.searchParams.get('quotes'));
    const wantSelf = quotes.includes(base);

    if (base === 'USD') {
      const direct = await loadDirect('USD', quotes.filter((q) => q !== 'USD'));
      const rates: Record<string, RateOut> = {};

      if (wantSelf) rates['USD'] = { rate: 1, derived: false, source: 'manual' };

      for (const [q, v] of Object.entries(direct)) {
        if (q === 'USD') continue;
        rates[q] = { rate: v.rate, asOf: v.asOf, source: v.source, derived: false };
      }

      const asOf = Object.values(rates)
        .map((x) => x.asOf)
        .filter(Boolean)
        .sort()
        .slice(-1)[0];

      return NextResponse.json({ ok: true, base, asOf, rates });
    }

    // Derived base != USD:
    // base->quote = (USD->quote) / (USD->base)
    const neededQuotes = quotes.length ? Array.from(new Set(['USD', base, ...quotes])) : [];
    const usdDirect = await loadDirect('USD', neededQuotes.length ? neededQuotes.filter((q) => q !== 'USD') : []);

    const usdToBase = base === 'USD' ? 1 : usdDirect[base]?.rate;
    if (!usdToBase || !Number.isFinite(usdToBase) || usdToBase <= 0) {
      return NextResponse.json({ ok: false, error: `Missing USD→${base} rate (cannot derive)` }, { status: 422 });
    }

    let quoteList: string[];
    if (quotes.length) {
      quoteList = quotes;
    } else {
      quoteList = Object.keys(usdDirect).filter((q) => q !== 'USD');
    }

    const rates: Record<string, RateOut> = {};
    for (const q of quoteList) {
      const qq = normCcy(q);
      if (!isCcy(qq)) continue;

      if (qq === base) {
        rates[qq] = { rate: 1, derived: false, source: 'manual' };
        continue;
      }

      if (qq === 'USD') {
        rates['USD'] = { rate: 1 / usdToBase, derived: true, source: usdDirect[base]?.source };
        continue;
      }

      const usdToQuote = usdDirect[qq]?.rate;
      if (!usdToQuote || !Number.isFinite(usdToQuote) || usdToQuote <= 0) continue;

      const r = usdToQuote / usdToBase;

      const a = usdDirect[qq]?.asOf;
      const b = usdDirect[base]?.asOf;
      const asOf = a && b ? (a < b ? a : b) : a || b;

      const srcA = usdDirect[qq]?.source;
      const srcB = usdDirect[base]?.source;
      const source = srcA === 'manual' || srcB === 'manual' ? 'manual' : 'auto';

      rates[qq] = { rate: r, asOf, source, derived: true };
    }

    const asOf = Object.values(rates)
      .map((x) => x.asOf)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];

    return NextResponse.json({ ok: true, base, asOf, rates });
  } catch (e: any) {
    console.error('fx/latest error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'FX error' }, { status: 500 });
  }
}
