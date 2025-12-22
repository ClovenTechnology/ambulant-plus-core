// apps/api-gateway/app/api/fx/audit/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminFinance, isCcy, normCcy } from '../_shared';

export async function GET(req: NextRequest) {
  try {
    assertAdminFinance(req);

    const url = new URL(req.url);
    const base = normCcy(url.searchParams.get('base') || 'USD');
    if (!isCcy(base)) return NextResponse.json({ ok: false, error: 'Invalid base' }, { status: 400 });

    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '50')));

    const rows = await prisma.fxAuditLog.findMany({
      where: { base },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      base,
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        actorEmail: r.actorEmail,
        actorUserId: r.actorUserId,
        action: r.action,
        note: r.note,
        requestId: r.requestId,
        ip: r.ip,
        userAgent: r.userAgent,
        changes: r.changesJson,
      })),
    });
  } catch (e: any) {
    const status = e?.status || 500;
    console.error('fx/audit error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Audit fetch failed' }, { status });
  }
}
