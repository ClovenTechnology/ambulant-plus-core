import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || 'org-default';

  const events = await prisma.runtimeEvent.findMany({
    where: {
      orgId,
      kind: {
        in: [
          'insight.governance.org.update',
          'insight.governance.pathway.update',
          'insight.experiment.update',
          'insight.model.rollout.update',
        ],
      },
    },
    orderBy: { ts: 'desc' },
    take: 100,
  });

  const items = events.map((ev) => ({
    id: ev.id,
    kind: ev.kind,
    orgId: ev.orgId,
    ts: ev.ts.toString(),
  }));

  return NextResponse.json({ items });
}