import { NextRequest, NextResponse } from 'next/server';
import { PrismaRuntimeExperimentAssignmentStore } from '@/src/insightcore/PrismaRuntimeExperimentAssignmentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  return NextResponse.json({
    items: await new PrismaRuntimeExperimentAssignmentStore().list(orgId),
  });
}