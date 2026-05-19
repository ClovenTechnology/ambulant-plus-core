// apps/api-gateway/src/insightcore/PrismaBaselineWindowStore.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';
import type {
  BaselineWindowRecord,
  BaselineWindowStore,
} from '../../../../packages/insightcore/src/baseline/BaselineWindowStore';

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

function toBaselineWindowRecord(value: unknown): BaselineWindowRecord | null {
  const payload = safeJsonObject(value);
  if (!payload) return null;

  return payload as BaselineWindowRecord;
}

export class PrismaBaselineWindowStore implements BaselineWindowStore {
  async load(
    patientId: string,
    window: BaselineWindowRecord['window'],
  ): Promise<BaselineWindowRecord | null> {
    const event = await prisma.runtimeEvent.findFirst({
      where: {
        kind: `insight.baseline.window.${window}`,
        patientId,
      },
      orderBy: { ts: 'desc' },
    });

    if (!event) return null;

    return toBaselineWindowRecord(event.payload);
  }

  async save(record: BaselineWindowRecord): Promise<void> {
    await prisma.runtimeEvent.create({
      data: {
        id: crypto.randomUUID(),
        ts: BigInt(Date.now()),
        kind: `insight.baseline.window.${record.window}`,
        patientId: record.patientId,
        orgId: 'org-default',
        payload: JSON.stringify(record),
      },
    });
  }
}