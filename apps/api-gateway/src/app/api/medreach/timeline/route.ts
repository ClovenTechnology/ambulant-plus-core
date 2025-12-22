// apps/api-gateway/app/api/medreach/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const externalId = url.searchParams.get('id') || '';

  if (!externalId) {
    return NextResponse.json(
      { error: 'Missing id parameter' },
      { status: 400 }
    );
  }

  const job = await prisma.medReachJob.findUnique({
    where: { externalId },
  });

  if (!job) {
    return NextResponse.json(
      { id: externalId, timeline: [] },
      { status: 200 }
    );
  }

  const entries = await prisma.medReachTimelineEntry.findMany({
    where: { jobId: job.id },
    orderBy: { at: 'asc' },
  });

  const timeline = entries.map((e) => ({
    status: e.status,
    at: e.at.toISOString(),
    note: e.note ?? undefined,
  }));

  return NextResponse.json({ id: externalId, timeline });
}
