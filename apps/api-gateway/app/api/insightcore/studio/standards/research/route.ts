import { NextResponse } from 'next/server';
import { OmopResearchEnvelope } from '@/../../packages/insightcore/src/standards/OmopResearchEnvelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: new OmopResearchEnvelope().build({
      patientId: 'pt-za-001',
      experiments: ['baseline-shift-rnd-v1'],
      researchSignals: [],
    }),
  });
}