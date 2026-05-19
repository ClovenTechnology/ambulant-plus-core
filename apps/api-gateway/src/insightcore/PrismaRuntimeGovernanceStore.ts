// apps/api-gateway/src/insightcore/PrismaRuntimeGovernanceStore.ts
import { prisma } from '@/src/lib/db';
import type { GovernanceStore } from '../../../../packages/insightcore/src/governance/DbOrgGovernanceProvider';
import type { GovernedPathway } from '../../../../packages/insightcore/src/contracts/governance';
import type { RuleWeightMap } from '../../../../packages/insightcore/src/governance/RuleWeightResolver';

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

function readRuleWeights(payload: Record<string, any> | null): RuleWeightMap {
  if (!payload) return {};

  if (isPlainObject(payload.ruleWeights)) {
    return payload.ruleWeights as RuleWeightMap;
  }

  if (isPlainObject(payload.weights)) {
    return payload.weights as RuleWeightMap;
  }

  return {};
}

export class PrismaRuntimeGovernanceStore implements GovernanceStore {
  async getRuleWeights(orgId: string): Promise<RuleWeightMap> {
    const latest = await prisma.runtimeEvent.findFirst({
      where: {
        kind: 'insight.governance.org.update',
        orgId,
      },
      orderBy: { ts: 'desc' },
    });

    if (!latest) return {};

    return readRuleWeights(safeJsonObject(latest.payload));
  }

  async getPathways(orgId: string): Promise<GovernedPathway[]> {
    const events = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.governance.pathway.update',
        orgId,
      },
      orderBy: { ts: 'desc' },
      take: 200,
    });

    const map = new Map<string, GovernedPathway>();

    for (const ev of events) {
      const payload = safeJsonObject(ev.payload);
      if (!payload) continue;

      const pathwayId = cleanString(payload.pathwayId) || cleanString(payload.id);
      if (!pathwayId || map.has(pathwayId)) continue;

      map.set(pathwayId, {
        id: pathwayId,
        version: cleanString(payload.version) || '1.0.0',
        enabled: Boolean(payload.enabled),
        owner: cleanString(payload.owner) || 'insightcore',
        title: cleanString(payload.title) || pathwayId,
        description: cleanString(payload.description),
        updatedAt: new Date(Number(ev.ts)).toISOString(),
      });
    }

    return [...map.values()];
  }
}