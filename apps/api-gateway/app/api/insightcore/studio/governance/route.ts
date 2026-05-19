import { NextResponse } from 'next/server';
import { PathwayRegistry } from '@/../../packages/insightcore/src/registry/PathwayRegistry';
import { ModelRegistry } from '@/../../packages/insightcore/src/ml/ModelRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const pathwayRegistry = new PathwayRegistry();
  const modelRegistry = new ModelRegistry();

  return NextResponse.json({
    pathways: await pathwayRegistry.list(),
    models: modelRegistry.list(),
  });
}