import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    item: {
      measurement: { score: 0.22, reasons: ['example_placeholder'] },
      inference: { score: 0.18, reasons: ['example_placeholder'] },
      clinical: { score: 0.28, reasons: ['example_placeholder'] },
      overall: 0.226,
    },
  });
}