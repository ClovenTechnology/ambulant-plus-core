// apps/api-gateway/src/insightcore/PrismaRuntimeExperimentAssignmentStore.ts
import { prisma } from '@/src/lib/db';

type RuntimeExperimentAssignmentSummary = {
  familyId: string;
  experimentId: string;
  active: boolean;
};

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

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export class PrismaRuntimeExperimentAssignmentStore {
  async list(orgId?: string): Promise<RuntimeExperimentAssignmentSummary[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.experiment.update',
        ...(orgId ? { orgId } : {}),
      },
      orderBy: { ts: 'desc' },
      take: 200,
    });

    const seen = new Map<string, RuntimeExperimentAssignmentSummary>();

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      const familyId = cleanString(payload.familyId) || 'unknown-family';
      const experimentId = cleanString(payload.id || payload.experimentId);
      if (!experimentId) continue;

      const key = `${familyId}:${experimentId}`;
      if (seen.has(key)) continue;

      seen.set(key, {
        familyId,
        experimentId,
        active: Boolean(payload.active),
      });
    }

    return [...seen.values()];
  }
}