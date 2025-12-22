// apps/api-gateway/app/api/orders/index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const enc = u.searchParams.get('encounterId') || undefined;

  const [pharm, lab] = await Promise.all([
    prisma.erxOrder.findMany({
      where: enc ? { encounterId: enc } : undefined,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.labOrder.findMany({
      where: enc ? { encounterId: enc } : undefined,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const rows = [
    ...pharm.map(o => ({
      id: o.id, kind: 'pharmacy' as const,
      encounterId: o.encounterId, sessionId: o.sessionId ?? '',
      caseId: o.caseId, createdAt: o.createdAt.toISOString(),
      title: o.drug, details: o.sig,
    })),
    ...lab.map(o => ({
      id: o.id, kind: 'lab' as const,
      encounterId: o.encounterId, sessionId: o.sessionId ?? '',
      caseId: o.caseId, createdAt: o.createdAt.toISOString(),
      title: o.panel, details: '',
    })),
  ].sort((a,b) => (b.createdAt! > a.createdAt! ? 1 : -1));

  return NextResponse.json(rows, { headers: { 'access-control-allow-origin': '*' } });
}
