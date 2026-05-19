import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: {
      generatedAt: new Date().toISOString(),
      models: [
        'sleep-debt-bp-trajectory',
        'sleep-debt-escalation-forecaster',
        'sleep-debt-recovery-engine',
      ],
      note: 'Sleep trajectory family scaffold is active.',
    },
  });
}