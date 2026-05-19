// apps/api-gateway/src/insightcore/PrismaLongitudinalBaselineStore.ts
import crypto from 'node:crypto';
import type { LongitudinalBaselineStore } from '../../../../packages/insightcore/src/baseline/LongitudinalBaselineStore';
import type { PersonalBaselineSnapshot } from '../../../../packages/insightcore/src/contracts/research';
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

function toPersonalBaselineSnapshot(value: unknown): PersonalBaselineSnapshot | null {
  const payload = safeJsonObject(value);
  if (!payload) return null;

  return payload as PersonalBaselineSnapshot;
}

export class PrismaLongitudinalBaselineStore implements LongitudinalBaselineStore {
  async load(patientId: string): Promise<PersonalBaselineSnapshot | null> {
    const event = await prisma.runtimeEvent.findFirst({
      where: {
        kind: 'insight.baseline.snapshot.v1',
        patientId,
      },
      orderBy: { ts: 'desc' },
    });

    if (!event) return null;

    return toPersonalBaselineSnapshot(event.payload);
  }

  async save(patientId: string, snapshot: PersonalBaselineSnapshot): Promise<void> {
    await prisma.runtimeEvent.create({
      data: {
        id: crypto.randomUUID(),
        ts: BigInt(Date.now()),
        kind: 'insight.baseline.snapshot.v1',
        patientId,
        orgId: 'org-default',
        payload: JSON.stringify(snapshot),
      },
    });
  }
}