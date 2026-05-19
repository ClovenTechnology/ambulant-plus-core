import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: {
      generatedAt: new Date().toISOString(),
      models: [
        'seizure-research-engine',
        'autonomic-shift-research-engine',
        'autonomic-stress-research-engine',
      ],
      note: 'Autonomic research family scaffold is active and remains research-gated.',
    },
  });
}