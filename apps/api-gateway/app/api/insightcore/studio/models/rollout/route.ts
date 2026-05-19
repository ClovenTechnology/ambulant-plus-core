import { NextRequest, NextResponse } from 'next/server';
import { PrismaRuntimeExperimentStore } from '@/src/insightcore/PrismaRuntimeExperimentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || 'org-default';
  const store = new PrismaRuntimeExperimentStore();
  const items = await store.listRollouts(orgId);

  if (items.length > 0) {
    return NextResponse.json({ items });
  }

  return NextResponse.json({
    items: [
      {
        modelId: 'rule-based-inference',
        version: '2.0.0',
        enabled: true,
        trafficPercent: 100,
        orgId,
        audience: 'all',
        updatedAt: new Date().toISOString(),
      },
      {
        modelId: 'composite-risk',
        version: '2.0.0',
        enabled: true,
        trafficPercent: 100,
        orgId,
        audience: 'all',
        updatedAt: new Date().toISOString(),
      },
    ],
  });
}