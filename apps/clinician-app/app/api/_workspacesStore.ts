// apps/clinician-app/app/api/_workspacesStore.ts
import type { Evidence, Finding } from '@/src/lib/workspaces/types';
import { randomUUID } from 'crypto';

type Annotation = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: string;
  evidenceId: string;
  findingId?: string | null;
  location?: unknown;
  type: string;
  payload?: unknown;
  createdAt: string;
  createdBy?: string;
};

type Revision = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty?: string;
  revisionNo?: number;
  createdAt: string;
  createdBy?: string;
  note?: string;
  evidenceIds?: string[];
  annotationCount?: number;
  meta?: unknown;
};

type PlanItem = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: string;
  label?: string;
  status?: string;
  createdAt: string;
  createdBy?: string;
  [key: string]: unknown;
};

type WorkspaceBucket = {
  findings: Finding[];
  evidence: Evidence[];
  annotations: Annotation[];
  revisions: Revision[];
  planItems: PlanItem[];
};

type WorkspaceKey = string;

const g = globalThis as any;

function getStore(): Map<WorkspaceKey, WorkspaceBucket> {
  if (!g.__AMB_WORKSPACES_STORE__) {
    g.__AMB_WORKSPACES_STORE__ = new Map<WorkspaceKey, WorkspaceBucket>();
  }

  return g.__AMB_WORKSPACES_STORE__ as Map<WorkspaceKey, WorkspaceBucket>;
}

/**
 * Canonicalize only for bucket keying.
 * This keeps "substance-abuse" and "substance_abuse" together,
 * while preserving the original specialty string on each record.
 */
export function canonicalizeSpecialty(s: unknown): string {
  const raw = String(s ?? '').trim().toLowerCase();

  if (!raw) {
    return 'unknown';
  }

  return raw.replace(/\s+/g, '_').replace(/-/g, '_');
}

function keyFor(patientId: string, encounterId: string, specialtyKey: string): WorkspaceKey {
  return `${patientId}::${encounterId}::${specialtyKey}`;
}

export function ensureBucket(
  patientId: string,
  encounterId: string,
  specialty: string,
): WorkspaceBucket {
  const workspaceStore = getStore();
  const k = keyFor(patientId, encounterId, canonicalizeSpecialty(specialty));
  const existing = workspaceStore.get(k);

  if (existing) {
    if (!Array.isArray(existing.planItems)) {
      existing.planItems = [];
    }

    return existing;
  }

  const fresh: WorkspaceBucket = {
    findings: [],
    evidence: [],
    annotations: [],
    revisions: [],
    planItems: [],
  };

  workspaceStore.set(k, fresh);

  return fresh;
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function addFinding(f: Finding) {
  const b = ensureBucket(f.patientId, f.encounterId, f.specialty);
  b.findings.unshift(f);
}

export function addEvidence(e: Evidence) {
  const b = ensureBucket(e.patientId, e.encounterId, e.specialty);
  b.evidence.unshift(e);
}

export function addAnnotation(a: Annotation) {
  const b = ensureBucket(a.patientId, a.encounterId, a.specialty);
  b.annotations.unshift(a);
}

export function addRevision(r: Revision) {
  const b = ensureBucket(r.patientId, r.encounterId, r.specialty ?? 'unknown');
  b.revisions.unshift(r);
}

export function getEncounterBundle(encounterId: string) {
  const workspaceStore = getStore();

  const bundles: Array<{
    specialtyKey: string;
    findings: Finding[];
    evidence: Evidence[];
    annotations: Annotation[];
    revisions: Revision[];
    planItems: PlanItem[];
  }> = [];

  for (const [k, v] of Array.from(workspaceStore.entries())) {
    const parts = k.split('::');
    const enc = parts[1];
    const specKey = parts[2] ?? 'unknown';

    if (enc !== encounterId) {
      continue;
    }

    bundles.push({
      specialtyKey: specKey,
      findings: v.findings,
      evidence: v.evidence,
      annotations: v.annotations,
      revisions: v.revisions,
      planItems: v.planItems ?? [],
    });
  }

  const flat = {
    findings: bundles.reduce<Finding[]>((acc, b) => acc.concat(b.findings), []),
    evidence: bundles.reduce<Evidence[]>((acc, b) => acc.concat(b.evidence), []),
    annotations: bundles.reduce<Annotation[]>((acc, b) => acc.concat(b.annotations), []),
    revisions: bundles.reduce<Revision[]>((acc, b) => acc.concat(b.revisions), []),
    planItems: bundles.reduce<PlanItem[]>((acc, b) => acc.concat(b.planItems), []),
  };

  return {
    bundles,
    flat,
  };
}

export function closeEncounter(encounterId: string) {
  const workspaceStore = getStore();
  const toDelete: string[] = [];

  for (const k of Array.from(workspaceStore.keys())) {
    const parts = k.split('::');

    if (parts[1] === encounterId) {
      toDelete.push(k);
    }
  }

  toDelete.forEach((k) => {
    workspaceStore.delete(k);
  });
}

/* ------------------------------------------------------------------
   Compatibility exports for legacy workspace API routes
   ------------------------------------------------------------------ */

type QueryLike = {
  patientId?: string | null;
  encounterId?: string | null;
  specialty?: string | null;
  [key: string]: unknown;
};

type QueryInput = QueryLike | URLSearchParams;

function queryValue(query: QueryInput | undefined, key: string): string | null {
  if (!query) {
    return null;
  }

  if (query instanceof URLSearchParams) {
    return query.get(key);
  }

  const value = query[key];

  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return null;
  }

  return String(value);
}

function matchesQuery(item: any, query?: QueryInput) {
  if (!query) {
    return true;
  }

  const patientId = queryValue(query, 'patientId');
  const encounterId = queryValue(query, 'encounterId');
  const specialty = queryValue(query, 'specialty');

  if (patientId && String(item.patientId) !== String(patientId)) {
    return false;
  }

  if (encounterId && String(item.encounterId) !== String(encounterId)) {
    return false;
  }

  if (
    specialty &&
    canonicalizeSpecialty(item.specialty) !== canonicalizeSpecialty(specialty)
  ) {
    return false;
  }

  return true;
}

export function filterByQuery<T extends Record<string, any>>(
  items: T[],
  query?: QueryInput,
): T[] {
  return items.filter((item) => matchesQuery(item, query));
}

/**
 * Legacy route compatibility.
 * Existing routes call:
 *
 *   const s = store();
 *
 * So this must remain a callable function, not an object export.
 */
export function store() {
  const findings: any[] = [];
  const evidence: any[] = [];
  const annotations: any[] = [];
  const revisions: any[] = [];
  const planItems: any[] = [];

  for (const bundle of Array.from(getStore().values())) {
    findings.push(...bundle.findings);
    evidence.push(...bundle.evidence);
    annotations.push(...bundle.annotations);
    revisions.push(...bundle.revisions);

    if (Array.isArray(bundle.planItems)) {
      planItems.push(...bundle.planItems);
    }
  }

  return {
    findings,
    evidence,
    annotations,
    revisions,
    planItems,
  };
}

export function createFinding(input: any) {
  const now = new Date().toISOString();

  const item = {
    id: input.id ?? makeId('finding'),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    ...input,
  } as Finding;

  addFinding(item);

  return item;
}

export function patchFinding(id: string, patch: any) {
  for (const bundle of Array.from(getStore().values())) {
    const idx = bundle.findings.findIndex((item: any) => item.id === id);

    if (idx >= 0) {
      const updated = {
        ...bundle.findings[idx],
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      } as Finding;

      bundle.findings[idx] = updated;

      return updated;
    }
  }

  return null;
}

export function createEvidence(input: any) {
  const now = new Date().toISOString();

  const item = {
    id: input.id ?? makeId('evidence'),
    capturedAt: input.capturedAt ?? now,
    ...input,
  } as Evidence;

  addEvidence(item);

  return item;
}

export function patchEvidence(id: string, patch: any) {
  for (const bundle of Array.from(getStore().values())) {
    const idx = bundle.evidence.findIndex((item: any) => item.id === id);

    if (idx >= 0) {
      const updated = {
        ...bundle.evidence[idx],
        ...patch,
        id,
      } as Evidence;

      bundle.evidence[idx] = updated;

      return updated;
    }
  }

  return null;
}

export function createAnnotation(input: any) {
  const now = new Date().toISOString();

  const item: Annotation = {
    id: input.id ?? makeId('annotation'),
    patientId: input.patientId,
    encounterId: input.encounterId,
    specialty: input.specialty ?? 'unknown',
    evidenceId: input.evidenceId,
    findingId: input.findingId ?? null,
    location: input.location,
    type: input.type ?? 'comment',
    payload: input.payload,
    createdAt: input.createdAt ?? now,
    createdBy: input.createdBy,
  };

  addAnnotation(item);

  return item;
}

function ensurePlanItemsBucket(
  patientId: string,
  encounterId: string,
  specialty: string,
) {
  const bucket = ensureBucket(patientId, encounterId, specialty);

  if (!Array.isArray(bucket.planItems)) {
    bucket.planItems = [];
  }

  return bucket.planItems;
}

export function createPlanItem(input: any) {
  const now = new Date().toISOString();

  const item: PlanItem = {
    id: input.id ?? makeId('plan'),
    patientId: input.patientId,
    encounterId: input.encounterId,
    specialty: input.specialty ?? 'unknown',
    label: input.label,
    status: input.status,
    createdAt: input.createdAt ?? now,
    createdBy: input.createdBy,
    ...input,
  };

  const list = ensurePlanItemsBucket(
    item.patientId,
    item.encounterId,
    item.specialty ?? 'unknown',
  );

  list.unshift(item);

  return item;
}

export function patchPlanItem(id: string, patch: any) {
  for (const bundle of Array.from(getStore().values())) {
    const list = bundle.planItems;

    if (!Array.isArray(list)) {
      continue;
    }

    const idx = list.findIndex((item: any) => item.id === id);

    if (idx >= 0) {
      const updated = {
        ...list[idx],
        ...patch,
        id,
      } as PlanItem;

      list[idx] = updated;

      return updated;
    }
  }

  return null;
}

export function createRevision(input: any) {
  const now = new Date().toISOString();

  const item: Revision = {
    id: input.id ?? makeId('revision'),
    patientId: input.patientId,
    encounterId: input.encounterId,
    specialty: input.specialty ?? 'unknown',
    createdAt: input.createdAt ?? now,
    revisionNo: input.revisionNo ?? store().revisions.length + 1,
    createdBy: input.createdBy,
    note: input.note,
    evidenceIds: input.evidenceIds,
    annotationCount: input.annotationCount,
    meta: input.meta,
  };

  addRevision(item);

  return item;
}