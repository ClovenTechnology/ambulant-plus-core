// apps/clinician-app/app/dental-workspace/_lib/api.ts
import type { DentalFinding, DentalEvidence, DentalAnnotation, LabRevision, PlanItem } from './types';

/* Default to /api because your clinician-app routes live under app/api/* */
export const API_BASE = (process.env.NEXT_PUBLIC_WORKSPACE_API_BASE || '/api').replace(/\/+$/, '');

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return ((json?.items ?? json?.data ?? json) as T) ?? (json as T);
}

export async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return (json?.item ?? json?.record ?? json?.data ?? json) as T;
}

export async function patchJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return (json?.item ?? json?.record ?? json?.data ?? json) as T;
}

export async function postFinding(req: Partial<DentalFinding>): Promise<DentalFinding> {
  return postJson<DentalFinding>(`${API_BASE}/findings`, req);
}

export async function postEvidence(req: Partial<DentalEvidence>): Promise<DentalEvidence> {
  return postJson<DentalEvidence>(`${API_BASE}/evidence`, req);
}

export async function postAnnotation(req: Partial<DentalAnnotation>): Promise<DentalAnnotation> {
  return postJson<DentalAnnotation>(`${API_BASE}/annotations`, req);
}

export async function postRevision(req: Partial<LabRevision>): Promise<LabRevision> {
  return postJson<LabRevision>(`${API_BASE}/revisions`, req);
}

export async function postPlanItem(req: Partial<PlanItem>): Promise<PlanItem> {
  return postJson<PlanItem>(`${API_BASE}/plan-items`, req);
}

export async function patchPlanItem(req: Partial<PlanItem> & { id: string }): Promise<PlanItem> {
  return patchJson<PlanItem>(`${API_BASE}/plan-items`, req);
}
