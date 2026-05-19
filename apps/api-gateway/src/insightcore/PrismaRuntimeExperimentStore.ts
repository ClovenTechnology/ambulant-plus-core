// apps/api-gateway/src/insightcore/PrismaRuntimeExperimentStore.ts
import { prisma } from '@/src/lib/db';
import type {
  ExperimentRecord,
  ModelRollout,
} from '../../../../packages/insightcore/src/contracts/rollout';
import type { ExperimentStore } from '../../../../packages/insightcore/src/ml/PersistedExperimentRegistry';

type ExperimentFamily = ExperimentRecord['family'];
type RolloutAudience = NonNullable<ModelRollout['audience']>;

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

function normalizeExperimentFamily(value: unknown): ExperimentFamily {
  const raw = cleanString(value).toLowerCase();

  if (raw === 'weights' || raw === 'pathway' || raw === 'ml') {
    return raw;
  }

  return 'weights';
}

function normalizeRolloutAudience(value: unknown): RolloutAudience {
  const raw = cleanString(value).toLowerCase();

  if (
    raw === 'clinician' ||
    raw === 'patient' ||
    raw === 'admin' ||
    raw === 'all'
  ) {
    return raw;
  }

  return 'all';
}

export class PrismaRuntimeExperimentStore implements ExperimentStore {
  async list(orgId?: string): Promise<ExperimentRecord[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.experiment.update',
        ...(orgId ? { orgId } : {}),
      },
      orderBy: { ts: 'desc' },
      take: 200,
    });

    const map = new Map<string, ExperimentRecord>();

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      const id = cleanString(payload.id);
      if (!id || map.has(id)) continue;

      map.set(id, {
        id,
        title: cleanString(payload.title) || id,
        family: normalizeExperimentFamily(payload.family),
        version: cleanString(payload.version) || '1.0.0',
        active: Boolean(payload.active),
        orgId: ev.orgId || undefined,
        updatedAt: new Date(Number(ev.ts)).toISOString(),
      });
    }

    return [...map.values()];
  }

  async listRollouts(orgId?: string): Promise<ModelRollout[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.model.rollout.update',
        ...(orgId ? { orgId } : {}),
      },
      orderBy: { ts: 'desc' },
      take: 200,
    });

    const map = new Map<string, ModelRollout>();

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      const modelId = cleanString(payload.modelId);
      const version = cleanString(payload.version) || '1.0.0';
      const audience = normalizeRolloutAudience(payload.audience);

      if (!modelId) continue;

      const key = `${modelId}:${version}:${audience}`;
      if (map.has(key)) continue;

      map.set(key, {
        modelId,
        version,
        enabled: Boolean(payload.enabled),
        trafficPercent: cleanNumber(payload.trafficPercent, 0),
        orgId: ev.orgId || undefined,
        audience,
        updatedAt: new Date(Number(ev.ts)).toISOString(),
      });
    }

    return [...map.values()];
  }
}