import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const clientId = ctx.params.id;
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, status: true },
  });

  if (!client) {
    return NextResponse.json({ ok: false, error: 'client_not_found' }, { status: 404 });
  }

  if (client.status !== 'ACTIVE' && !includeInactive) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const items = await prisma.coveragePlan.findMany({
    where: {
      clientId,
      ...(includeInactive ? {} : { status: 'ACTIVE' }),
    },
    orderBy: [{ name: 'asc' }],
    include: {
      serviceRules: {
        where: { enabled: true },
        orderBy: [{ serviceType: 'asc' }],
      },
    },
  });

  return NextResponse.json(
    { ok: true, clientId, items },
    { headers: { 'cache-control': 'no-store' } },
  );
}