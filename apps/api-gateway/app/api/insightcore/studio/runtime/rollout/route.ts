import { NextRequest, NextResponse } from 'next/server';
import { PrismaRuntimeRolloutStore } from '@/src/insightcore/PrismaRuntimeRolloutStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  return NextResponse.json({
    items: await new PrismaRuntimeRolloutStore().list(orgId),
  });
}