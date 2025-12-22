// apps/api-gateway/app/api/clinicians/[id]/refunds/route.ts (I think this file needs to be corrected)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

// Legacy path kept for compatibility with earlier UIs.
// Returns the same shape as /refund-policy.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const userId = params.id;
  try {
    const r = await prisma.clinicianRefundPolicy.findUnique({ where: { userId } });
    const effective = r ? {
      within24hPercent: r.within24hPercent,
      noShowPercent: r.noShowPercent,
      clinicianMissPercent: r.clinicianMissPercent,
      networkProrate: r.networkProrate,
    } : {
      within24hPercent: 50,
      noShowPercent: 0,
      clinicianMissPercent: 100,
      networkProrate: true,
    };
    return NextResponse.json({ effective });
  } catch (e: any) {
    return NextResponse.json({ error: 'refund_policy_failed', detail: e?.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
