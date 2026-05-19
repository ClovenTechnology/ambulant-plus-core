// apps/api-gateway/src/insightcore/PrismaRuntimeRolloutStore.ts
import { prisma } from '@/src/lib/db';

type RuntimeRolloutSummary = {
  familyId: string;
  enabled: boolean;
  trafficPercent: number;
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

function cleanNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class PrismaRuntimeRolloutStore {
  async list(orgId?: string): Promise<RuntimeRolloutSummary[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.model.rollout.update',
        ...(orgId ? { orgId } : {}),
      },
      orderBy: { ts: 'desc' },
      take: 200,
    });

    const seen = new Map<string, RuntimeRolloutSummary>();

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      const familyId = cleanString(payload.familyId) || cleanString(payload.modelId);
      if (!familyId || seen.has(familyId)) continue;

      seen.set(familyId, {
        familyId,
        enabled: Boolean(payload.enabled),
        trafficPercent: cleanNumber(payload.trafficPercent, 0),
      });
    }

    return [...seen.values()];
  }
}