import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const prof = await prisma.clinicianProfile.findUnique({
      where: { userId: id },
      select: { refundPolicy: true, freeCancelHours: true, lateCancelFeeCents: true, currency: true },
    });

    // Return a sensible default even if not configured yet
    return NextResponse.json({
      clinicianId: id,
      policy:
        prof?.refundPolicy ??
        'Refunds: 100% if cancelled ≥24h before start; 50% if 6–24h; no refund within 6h of start. Exceptions at clinician’s discretion.',
      freeCancelHours: prof?.freeCancelHours ?? 24,
      lateCancelFeeCents: prof?.lateCancelFeeCents ?? 0,
      currency: prof?.currency ?? 'ZAR',
    });
  } catch (e: any) {
    // still respond 200 with a default so the modal never shows an error
    return NextResponse.json({
      clinicianId: id,
      policy:
        'Refunds: 100% if cancelled ≥24h before start; 50% if 6–24h; no refund within 6h of start. Exceptions at clinician’s discretion.',
      freeCancelHours: 24,
      lateCancelFeeCents: 0,
      currency: 'ZAR',
      hint: `policy_failed: ${e?.message || e}`,
    });
  }
}
