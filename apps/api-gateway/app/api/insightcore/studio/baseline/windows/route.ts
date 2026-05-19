import { NextRequest, NextResponse } from 'next/server';
import { PrismaBaselineWindowStore } from '@/src/insightcore/PrismaBaselineWindowStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId');
  if (!patientId) {
    return NextResponse.json({ error: 'patientId_required' }, { status: 400 });
  }

  const store = new PrismaBaselineWindowStore();
  const [last24h, last7d, last30d] = await Promise.all([
    store.load(patientId, '24h'),
    store.load(patientId, '7d'),
    store.load(patientId, '30d'),
  ]);

  return NextResponse.json({
    item: {
      patientId,
      windows: {
        last24h,
        last7d,
        last30d,
      },
    },
  });
}