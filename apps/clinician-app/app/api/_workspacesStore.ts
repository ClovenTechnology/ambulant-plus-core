// apps/clinician-app/app/api/_workspacesStore.ts
import type { Annotation, Evidence, Finding, Revision } from '@/src/lib/workspaces/types';
import { randomUUID } from 'crypto';

type WorkspaceBucket = {
  findings: Finding[];
  evidence: Evidence[];
  annotations: Annotation[];
  revisions: Revision[];
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
 * Canonicalize only for bucket keying (so "substance-abuse" and "substance_abuse" land together if needed),
 * but we still preserve the original `specialty` string on each record.
 */
export function canonicalizeSpecialty(s: unknown): string {
  const raw = String(s ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';
  return raw.replace(/\s+/g, '_').replace(/-/g, '_');
}

function keyFor(patientId: string, encounterId: string, specialtyKey: string): WorkspaceKey {
  return `${patientId}::${encounterId}::${specialtyKey}`;
}

export function ensureBucket(patientId: string, encounterId: string, specialty: string): WorkspaceBucket {
  const store = getStore();
  const k = keyFor(patientId, encounterId, canonicalizeSpecialty(specialty));
  const existing = store.get(k);
  if (existing) return existing;

  const fresh: WorkspaceBucket = { findings: [], evidence: [], annotations: [], revisions: [] };
  store.set(k, fresh);
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
  const store = getStore();

  const bundles: Array<{
    specialtyKey: string;
    findings: Finding[];
    evidence: Evidence[];
    annotations: Annotation[];
    revisions: Revision[];
  }> = [];

  for (const [k, v] of store.entries()) {
    const parts = k.split('::');
    const enc = parts[1];
    const specKey = parts[2] ?? 'unknown';
    if (enc !== encounterId) continue;

    bundles.push({
      specialtyKey: specKey,
      findings: v.findings,
      evidence: v.evidence,
      annotations: v.annotations,
      revisions: v.revisions,
    });
  }

  // Convenience flattened view (useful for payer packet)
  const flat = {
    findings: bundles.flatMap((b) => b.findings),
    evidence: bundles.flatMap((b) => b.evidence),
    annotations: bundles.flatMap((b) => b.annotations),
    revisions: bundles.flatMap((b) => b.revisions),
  };

  return { bundles, flat };
}

export function closeEncounter(encounterId: string) {
  const store = getStore();
  const toDelete: string[] = [];
  for (const k of store.keys()) {
    const parts = k.split('::');
    if (parts[1] === encounterId) toDelete.push(k);
  }
  toDelete.forEach((k) => store.delete(k));
}
