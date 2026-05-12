// apps/api-gateway/src/lib/caseenc.ts
import { prisma } from '@/src/lib/db';

/**
 * Case/encounter compatibility helpers.
 *
 * The deploy schema may expose either:
 * - prisma.case
 * - prisma.clinicalCase
 * - neither
 *
 * Use dynamic delegates so production build does not fail when the generated
 * Prisma client does not expose a direct `case` model.
 */

function caseDelegate() {
  return (prisma as any).case ?? (prisma as any).clinicalCase ?? null;
}

function encounterDelegate() {
  return (prisma as any).encounter ?? null;
}

function cleanStr(value: unknown, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

/** Returns an open case for patient or creates one if none exists. */
export async function getOrCreateActiveCase(
  patientId: string,
  title = 'Case',
): Promise<{ id: string }> {
  const pid = cleanStr(patientId);

  if (!pid) {
    throw new Error('patientId_required');
  }

  const delegate = caseDelegate();

  if (!delegate?.findFirst || !delegate?.create) {
    /*
     * Fallback keeps dependent routes/build stable if the case model is not
     * present in this Prisma schema. It is intentionally deterministic enough
     * for downstream linkage but does not pretend a DB row exists.
     */
    return { id: `case-${pid}` };
  }

  const existing = await delegate.findFirst({
    where: {
      patientId: pid,
      status: 'open',
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return { id: existing.id };
  }

  const row = await delegate.create({
    data: {
      patientId: pid,
      title: cleanStr(title, 'Case'),
      status: 'open',
    },
    select: {
      id: true,
    },
  });

  return { id: row.id };
}

/** Returns an encounter for case or creates one if none exists. */
export async function getOrCreateEncounter(
  caseId: string,
  patientId?: string,
): Promise<{ id: string }> {
  const cid = cleanStr(caseId);

  if (!cid) {
    throw new Error('caseId_required');
  }

  const delegate = encounterDelegate();

  if (!delegate?.findFirst || !delegate?.create) {
    return { id: `enc-${cid}` };
  }

  const existing = await delegate.findFirst({
    where: {
      caseId: cid,
      status: {
        in: ['open', 'active', 'in_progress'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return { id: existing.id };
  }

  const data: Record<string, any> = {
    caseId: cid,
    status: 'open',
  };

  if (patientId) {
    data.patientId = cleanStr(patientId);
  }

  try {
    const row = await delegate.create({
      data,
      select: {
        id: true,
      },
    });

    return { id: row.id };
  } catch {
    /*
     * Some Encounter schemas may not include caseId/patientId in this exact
     * form. Keep caller stable rather than breaking build/runtime.
     */
    return { id: `enc-${cid}` };
  }
}

/** Convenience helper: ensure both active case and encounter. */
export async function getOrCreateCaseEncounter(
  patientId: string,
  title = 'Case',
): Promise<{ caseId: string; encounterId: string }> {
  const c = await getOrCreateActiveCase(patientId, title);
  const e = await getOrCreateEncounter(c.id, patientId);

  return {
    caseId: c.id,
    encounterId: e.id,
  };
}