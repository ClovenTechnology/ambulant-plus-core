import type {
  Annotation,
  CreateAnnotationRequest,
  CreateEvidenceRequest,
  CreateFindingRequest,
  Evidence,
  Finding,
} from './types';

type ApiError = { message: string; status?: number; details?: any };

// Default to /api because your app already uses /api/* elsewhere.
// Override with NEXT_PUBLIC_WORKSPACE_API_BASE if needed.
const API_BASE =
  (process.env.NEXT_PUBLIC_WORKSPACE_API_BASE || '/api').replace(/\/+$/, '');

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let details: any = null;
    try {
      details = await res.json();
    } catch {
      // ignore
    }
    const err: ApiError = {
      status: res.status,
      message: details?.message || `HTTP ${res.status}`,
      details,
    };
    throw err;
  }

  return (await res.json()) as T;
}

export async function postFinding(req: CreateFindingRequest): Promise<Finding> {
  return apiPost<Finding>(`${API_BASE}/findings`, req);
}

export async function postEvidence(req: CreateEvidenceRequest): Promise<Evidence> {
  return apiPost<Evidence>(`${API_BASE}/evidence`, req);
}

export async function postAnnotation(req: CreateAnnotationRequest): Promise<Annotation> {
  return apiPost<Annotation>(`${API_BASE}/annotations`, req);
}
