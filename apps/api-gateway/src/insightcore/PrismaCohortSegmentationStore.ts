// apps/api-gateway/src/insightcore/PrismaCohortSegmentationStore.ts
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

function isHighOrCritical(value: unknown): boolean {
  const severity = String(value || '').trim().toLowerCase();
  return severity === 'high' || severity === 'critical';
}

function containsNeedle(value: unknown, needle: string): boolean {
  return String(value || '').toLowerCase().includes(needle);
}

export class PrismaCohortSegmentationStore {
  async summary(orgId?: string) {
    const [episodeEvents, experimentEvents] = await Promise.all([
      prisma.runtimeEvent.findMany({
        where: {
          kind: 'insight.episode.v1',
          ...(orgId ? { orgId } : {}),
        },
        orderBy: { ts: 'desc' },
        take: 500,
      }),
      prisma.runtimeEvent.findMany({
        where: {
          kind: 'insight.experiment.update',
          ...(orgId ? { orgId } : {}),
        },
        orderBy: { ts: 'desc' },
        take: 500,
      }),
    ]);

    const patientSet = new Set<string>();
    let totalEpisodes = 0;
    let highOrCriticalEpisodes = 0;
    let maternalEpisodes = 0;
    let chronicEpisodes = 0;

    for (const ev of episodeEvents) {
      totalEpisodes += 1;

      if (ev.patientId) {
        patientSet.add(ev.patientId);
      }

      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      if (isHighOrCritical(payload.severity)) {
        highOrCriticalEpisodes += 1;
      }

      if (containsNeedle(payload.syndrome, 'maternal')) {
        maternalEpisodes += 1;
      }

      if (
        containsNeedle(payload.status, 'watching') ||
        containsNeedle(payload.title, 'chronic')
      ) {
        chronicEpisodes += 1;
      }
    }

    const researchPatientSet = new Set<string>();
    let activeAssignments = 0;

    for (const ev of experimentEvents) {
      const payload = safeJsonObject(ev.payload);

      if (payload?.active) {
        activeAssignments += 1;
      }

      if (ev.patientId) {
        researchPatientSet.add(ev.patientId);
      }
    }

    const totalPatients = patientSet.size;
    const researchPatients = researchPatientSet.size;

    const maternalPatients = Math.min(
      totalPatients,
      maternalEpisodes > 0 ? Math.max(1, Math.ceil(maternalEpisodes / 2)) : 0,
    );

    const chronicPatients = Math.min(
      Math.max(0, totalPatients - maternalPatients),
      chronicEpisodes > 0 ? Math.max(1, Math.ceil(chronicEpisodes / 2)) : 0,
    );

    return {
      totalPatients,
      totalEpisodes,
      totalAlerts: 0,
      highOrCriticalEpisodes,
      maternalPatients,
      maternalEpisodes,
      chronicPatients,
      chronicEpisodes,
      researchPatients,
      activeAssignments,
    };
  }
}