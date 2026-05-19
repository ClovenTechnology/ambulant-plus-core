import { NextRequest, NextResponse } from 'next/server';
import { PersistedExperimentRegistry } from '@/../../packages/insightcore/src/ml/PersistedExperimentRegistry';
import { PrismaRuntimeExperimentStore } from '@/src/insightcore/PrismaRuntimeExperimentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || 'org-default';
  const registry = new PersistedExperimentRegistry(new PrismaRuntimeExperimentStore());

  return NextResponse.json({
    items: await registry.active(orgId),
  });
}