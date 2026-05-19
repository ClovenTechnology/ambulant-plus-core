// apps/api-gateway/src/insightcore/PrismaCohortIntelligenceStore.ts
import { prisma } from '@/src/lib/db';

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

function isHighOrCriticalSeverity(value: unknown): boolean {
  const severity = String(value || '').trim().toLowerCase();
  return severity === 'high' || severity === 'critical';
}

export class PrismaCohortIntelligenceStore {
  async summary(orgId?: string) {
    const where = {
      kind: 'insight.episode.v1',
      ...(orgId ? { orgId } : {}),
    };

    const [episodes, alerts, patients, latestEpisodes] = await Promise.all([
      prisma.runtimeEvent.count({
        where,
      }),
      prisma.runtimeEvent.count({
        where: {
          kind: 'insight.alert.risk',
          ...(orgId ? { orgId } : {}),
        },
      }),
      prisma.runtimeEvent.findMany({
        where,
        select: { patientId: true },
        distinct: ['patientId'],
      }),
      prisma.runtimeEvent.findMany({
        where,
        orderBy: { ts: 'desc' },
        take: 100,
      }),
    ]);

    let highOrCriticalEpisodes = 0;

    for (const ev of latestEpisodes) {
      const payload = safeJsonObject(ev.payload);

      if (isHighOrCriticalSeverity(payload?.severity)) {
        highOrCriticalEpisodes += 1;
      }
    }

    return {
      totalEpisodes: episodes,
      totalAlerts: alerts,
      totalPatients: patients.length,
      highOrCriticalEpisodes,
    };
  }
}