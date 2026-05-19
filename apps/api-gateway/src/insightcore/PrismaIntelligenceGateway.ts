// apps/api-gateway/src/insightcore/PrismaIntelligenceGateway.ts
import { prisma } from '@/src/lib/db';
import type { Alert, Episode } from '../../../../packages/insightcore/src';

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

function isResolvedEpisode(payload: Record<string, any>): boolean {
  return String(payload.status || '').trim().toLowerCase() === 'resolved';
}

function severityFromEvent(value: unknown): Alert['severity'] {
  const severity = String(value || '').trim().toLowerCase();

  if (
    severity === 'low' ||
    severity === 'moderate' ||
    severity === 'high' ||
    severity === 'critical'
  ) {
    return severity as Alert['severity'];
  }

  return 'moderate' as Alert['severity'];
}

function scoreFromPayload(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0.5;

  if (n > 1) {
    return Math.max(0, Math.min(1, n / 100));
  }

  return Math.max(0, Math.min(1, n));
}

export class PrismaIntelligenceGateway {
  async loadOpenEpisodes(patientId: string): Promise<Episode[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.episode.v1',
        patientId,
      },
      orderBy: { ts: 'desc' },
      take: 50,
    });

    const out: Episode[] = [];

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);

      if (!payload || isResolvedEpisode(payload)) continue;

      out.push(payload as Episode);
    }

    return out;
  }

  async loadRecentAlerts(patientId: string): Promise<Alert[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.alert.risk',
        patientId,
      },
      orderBy: { ts: 'desc' },
      take: 50,
    });

    const out: Alert[] = [];

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      out.push({
        id: ev.id,
        patientId: ev.patientId || patientId,
        type: String(payload.ruleName || 'Clinical risk'),
        syndrome: payload.syndrome,
        severity: severityFromEvent((ev as any).severity),
        score: scoreFromPayload(payload.score),
        source: 'episode',
        timestamp: new Date(Number(ev.ts)).toISOString(),
        status: 'new',
        message: String(payload.message || 'Risk alert'),
        evidence: [],
        rationale: [],
        suppressionKey: payload.suppressionKey,
        episodeId: payload.episodeId,
        audience: ['clinician'],
      } as Alert);
    }

    return out;
  }
}