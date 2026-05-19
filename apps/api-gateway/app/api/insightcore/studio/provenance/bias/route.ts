import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    items: [
      {
        code: 'pulse_ox_skin_tone_bias',
        label: 'Pulse oximetry skin tone bias risk',
        severity: 'moderate',
      },
      {
        code: 'bp_cuff_size_mismatch',
        label: 'Blood pressure cuff size mismatch risk',
        severity: 'moderate',
      },
    ],
  });
}