// apps/api-gateway/app/api/fx/manual/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminFinance, isCcy, normCcy, safeAsOf, toNumberDecimal } from '../_shared';

type Body = {
  base?: string;
  asOf?: string;
  note?: string;
  rates?: Record<string, number | string>;
};

export async function PUT(req: NextRequest) {
  try {
    assertAdminFinance(req);

    const body = (await req.json().catch(() => ({}))) as Body;

    const base = normCcy(body.base || 'USD');
    if (!isCcy(base)) return NextResponse.json({ ok: false, error: 'Invalid base' }, { status: 400 });

    const asOf = safeAsOf(body.asOf);
    const note = String(body.note || '').trim() || null;

    const ratesIn = body.rates || {};
    const entries = Object.entries(ratesIn)
      .map(([quoteRaw, rateRaw]) => {
        const quote = normCcy(quoteRaw);
        const rate = Number(rateRaw);
        return { quote, rate };
      })
      .filter((x) => isCcy(x.quote) && x.quote !== base && Number.isFinite(x.rate) && x.rate > 0);

    if (!entries.length) {
      return NextResponse.json({ ok: false, error: 'No valid rates provided' }, { status: 400 });
    }

    const quotes = entries.map((x) => x.quote);

    const current = await prisma.fxRate.findMany({
      where: { base, quote: { in: quotes }, status: 'active', source: 'manual' },
      orderBy: [{ quote: 'asc' }, { asOf: 'desc' }],
    });

    const currentPick = new Map<string, typeof current[number]>();
    for (const r of current) {
      if (!currentPick.has(r.quote)) currentPick.set(r.quote, r);
    }

    const diffs = entries.map((x) => {
      const prev = currentPick.get(x.quote);
      const before = prev
        ? { rate: toNumberDecimal(prev.rate), asOf: prev.asOf.toISOString(), source: prev.source }
        : null;
      const after = { rate: x.rate, asOf: asOf.toISOString(), source: 'manual' as const };
      return { quote: x.quote, before, after };
    });

    const bigMove = diffs.some((d) => {
      if (!d.before) return false;
      const b = Number(d.before.rate);
      const a = Number(d.after.rate);
      if (!b || !Number.isFinite(b) || b <= 0) return false;
      return Math.abs(a - b) / b > 0.1;
    });

    if (bigMove && !note) {
      return NextResponse.json({ ok: false, error: 'Note required for changes > 10%' }, { status: 400 });
    }

    const requestId = req.headers.get('x-request-id') || '';
    const ip = req.headers.get('x-forwarded-for') || '';
    const ua = req.headers.get('user-agent') || '';

    await prisma.$transaction(async (tx) => {
      await tx.fxRate.updateMany({
        where: { base, quote: { in: quotes }, status: 'active', source: 'manual' },
        data: { status: 'superseded' },
      });

      for (const x of entries) {
        await tx.fxRate.create({
          data: {
            base,
            quote: x.quote,
            rate: x.rate,
            asOf,
            source: 'manual',
            status: 'active',
            note: note || undefined,
          },
        });
      }

      await tx.fxAuditLog.create({
        data: {
          actorUserId: null,
          actorEmail: null,
          action: 'FX_UPSERT_BULK',
          base,
          note: note || undefined,
          requestId: requestId || undefined,
          ip: ip || undefined,
          userAgent: ua || undefined,
          changesJson: diffs as any,
        },
      });
    });

    return NextResponse.json({ ok: true, base, asOf: asOf.toISOString(), updated: diffs.length });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error('fx/manual error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'FX write failed' }, { status });
  }
}
