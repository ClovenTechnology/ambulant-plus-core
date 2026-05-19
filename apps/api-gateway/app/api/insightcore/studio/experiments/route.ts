import { NextResponse } from 'next/server';
import { ExperimentRegistry } from '@/../../packages/insightcore/src/ml/ExperimentRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = new ExperimentRegistry();
  return NextResponse.json({
    items: registry.list(),
  });
}