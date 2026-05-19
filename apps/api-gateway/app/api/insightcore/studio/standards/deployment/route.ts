import { NextRequest, NextResponse } from 'next/server';
import { PrismaBaselineWindowStore } from '@/src/insightcore/PrismaBaselineWindowStore';
import { OmopDeploymentEnvelope } from '@/../../packages/insightcore/src/standards/OmopDeploymentEnvelope';
import { OmopBaselineProjection } from '@/../../packages/insightcore/src/omop/OmopBaselineProjection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId');
  if (!patientId) {
    return NextResponse.json({ error: 'patientId_required' }, { status: 400 });
  }

  const store = new PrismaBaselineWindowStore();
  const [last24h, last7d, last30d] = await Promise.all([
    store.load(patientId, '24h'),
    store.load(patientId, '7d'),
    store.load(patientId, '30d'),
  ]);

  return NextResponse.json({
    item: new OmopDeploymentEnvelope().build({
      patientId,
      baseline: new OmopBaselineProjection().map({
        patientId,
        generatedAt: new Date().toISOString(),
        windows: {
          last24h: last24h?.snapshot ?? null,
          last7d: last7d?.snapshot ?? null,
          last30d: last30d?.snapshot ?? null,
        },
      }),
      episodes: [],
    }),
  });
}