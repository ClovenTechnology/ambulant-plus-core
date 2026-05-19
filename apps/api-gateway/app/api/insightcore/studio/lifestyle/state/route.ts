import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: {
      generatedAt: new Date().toISOString(),
      states: [
        'sleep_stress_coupling',
        'dehydration_autonomic_load',
      ],
    },
  });
}