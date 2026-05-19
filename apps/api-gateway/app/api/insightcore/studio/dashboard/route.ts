// apps/api-gateway/app/api/insightcore/studio/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonObject(value: unknown): Record<string, any> | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isPlainObject(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined;
  const orgFilter = orgId ? { orgId } : {};

  const [episodes, alerts, traces, lineage] = await Promise.all([
    prisma.runtimeEvent.count({
      where: {
        kind: 'insight.episode.v1',
        ...orgFilter,
      },
    }),
    prisma.runtimeEvent.count({
      where: {
        kind: 'insight.alert.risk',
        ...orgFilter,
      },
    }),
    prisma.runtimeEvent.count({
      where: {
        kind: 'insight.trace.v1',
        ...orgFilter,
      },
    }),
    prisma.runtimeEvent.count({
      where: {
        kind: 'insight.lineage.v1',
        ...orgFilter,
      },
    }),
  ]);

  const latestEpisodes = await prisma.runtimeEvent.findMany({
    where: {
      kind: 'insight.episode.v1',
      ...orgFilter,
    },
    orderBy: { ts: 'desc' },
    take: 50,
  });

  let highOrCriticalEpisodes = 0;

  for (const ev of latestEpisodes) {
    const payload = safeJsonObject(ev.payload);
    const severity = String(payload?.severity || '').toLowerCase();

    if (severity === 'high' || severity === 'critical') {
      highOrCriticalEpisodes += 1;
    }
  }

  return NextResponse.json({
    metrics: {
      totalEpisodes: episodes,
      highOrCriticalEpisodes,
      totalAlerts: alerts,
      totalTraces: traces,
      totalLineageRecords: lineage,
    },
  });
}