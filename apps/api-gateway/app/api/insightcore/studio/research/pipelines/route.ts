import { NextResponse } from 'next/server';
import { ResearchPipelinePlanner } from '@/../../packages/insightcore/src/research/ResearchPipelinePlanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: new ResearchPipelinePlanner().build(),
  });
}