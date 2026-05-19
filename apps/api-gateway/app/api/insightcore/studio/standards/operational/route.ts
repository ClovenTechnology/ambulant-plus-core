// apps/api-gateway/app/api/insightcore/studio/standards/operational/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { FhirEpisodeProjector } from '@/../../packages/insightcore/src/fhir/FhirEpisodeProjector';
import { FhirIntelligenceEnvelope } from '@/../../packages/insightcore/src/fhir/FhirIntelligenceEnvelope';
import type { Episode } from '@/../../packages/insightcore/src';

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

function toEpisode(value: unknown): Episode | null {
  const payload = safeJsonObject(value);
  if (!payload) return null;

  return payload as Episode;
}

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId');

  if (!patientId) {
    return NextResponse.json({ error: 'patientId_required' }, { status: 400 });
  }

  const events = await prisma.runtimeEvent.findMany({
    where: {
      kind: 'insight.episode.v1',
      patientId,
    },
    orderBy: { ts: 'desc' },
    take: 20,
  });

  const episodes = events.flatMap((ev): Episode[] => {
    const episode = toEpisode(ev.payload);
    return episode ? [episode] : [];
  });

  const issues = new FhirEpisodeProjector().map(episodes);

  return NextResponse.json({
    item: new FhirIntelligenceEnvelope().build({
      observations: [],
      issues,
    }),
    meta: {
      patientId,
      episodeCount: episodes.length,
      issueCount: issues.length,
    },
  });
}