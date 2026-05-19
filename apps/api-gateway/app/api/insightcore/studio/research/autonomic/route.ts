import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: {
      enabled: false,
      mode: 'off',
      rationale: 'research_gate_default_off',
      notes: [
        'Autonomic research pathway is scaffolded but not active in deployment.',
        'Further work should integrate HRV, sleep debt, stress, and baseline-shift patterns.',
      ],
    },
  });
}