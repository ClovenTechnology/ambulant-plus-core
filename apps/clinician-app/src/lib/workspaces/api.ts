import type {
  Annotation,
  CreateAnnotationRequest,
  CreateEvidenceRequest,
  CreateFindingRequest,
  Evidence,
  Finding,
} from './types';

type ApiError = {
  message: string;
  status?: number;
  details?: any;
};

type ItemEnvelope<T> = {
  ok?: boolean;
  item?: T;
  message?: string;
  error?: string;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_WORKSPACE_API_BASE || '/api').replace(
    /\/+$/,
    '',
  );

async function apiItemRequest<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: any,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const details = (await res
    .json()
    .catch(() => null)) as ItemEnvelope<T> | T | null;

  if (
    !res.ok ||
    (details &&
      typeof details === 'object' &&
      'ok' in details &&
      (details as ItemEnvelope<T>).ok === false)
  ) {
    const envelope = details as ItemEnvelope<T> | null;

    const err: ApiError = {
      status: res.status,
      message:
        envelope?.message ||
        envelope?.error ||
        `HTTP ${res.status}`,
      details,
    };

    throw err;
  }

  if (
    details &&
    typeof details === 'object' &&
    'item' in details &&
    (details as ItemEnvelope<T>).item
  ) {
    return (details as ItemEnvelope<T>).item as T;
  }

  return details as T;
}

export async function postFinding(
  req: CreateFindingRequest,
): Promise<Finding> {
  return apiItemRequest<Finding>(
    `${API_BASE}/findings`,
    'POST',
    req,
  );
}

export async function postEvidence(
  req: CreateEvidenceRequest,
): Promise<Evidence> {
  return apiItemRequest<Evidence>(
    `${API_BASE}/evidence`,
    'POST',
    req,
  );
}

export async function patchEvidence(
  id: string,
  patch: Partial<Evidence>,
): Promise<Evidence> {
  return apiItemRequest<Evidence>(
    `${API_BASE}/evidence`,
    'PATCH',
    {
      id,
      ...patch,
    },
  );
}

export async function postAnnotation(
  req: CreateAnnotationRequest,
): Promise<Annotation> {
  return apiItemRequest<Annotation>(
    `${API_BASE}/annotations`,
    'POST',
    req,
  );
}
