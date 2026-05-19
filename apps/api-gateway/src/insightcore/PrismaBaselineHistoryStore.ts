// apps/api-gateway/src/insightcore/PrismaBaselineHistoryStore.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import type { BaselineHistoryStore } from '../../../../packages/insightcore/src/baseline/BaselineHistoryStore';
import type {
  PersonalBaselineHistory,
  BaselineHistoryPoint,
} from '../../../../packages/insightcore/src/baseline/PersonalBaselineHistory';

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

function toBaselineHistoryPoint(value: unknown): BaselineHistoryPoint | null {
  const payload = safeJsonObject(value);
  if (!payload) return null;

  return payload as BaselineHistoryPoint;
}

export class PrismaBaselineHistoryStore implements BaselineHistoryStore {
  async load(patientId: string): Promise<PersonalBaselineHistory | null> {
    const rows = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'baseline.history.point',
        patientId,
      },
      orderBy: { ts: 'asc' },
      take: 500,
    });

    if (!rows.length) return null;

    const points = rows.flatMap((row): BaselineHistoryPoint[] => {
      const point = toBaselineHistoryPoint(row.payload);
      return point ? [point] : [];
    });

    if (!points.length) return null;

    return {
      patientId,
      points,
    };
  }

  async append(patientId: string, point: BaselineHistoryPoint) {
    await prisma.runtimeEvent.create({
      data: {
        id: crypto.randomUUID(),
        ts: BigInt(Date.now()),
        kind: 'baseline.history.point',
        patientId,
        payload: JSON.stringify(point),
      },
    });
  }
}