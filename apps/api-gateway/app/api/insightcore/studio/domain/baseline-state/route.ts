import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: {
      generatedAt: new Date().toISOString(),
      models: [
        'baseline-deviation-engine',
        'baseline-state-interpreter',
      ],
      note: 'Baseline state interpretation family scaffold is active.',
    },
  });
}