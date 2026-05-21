// apps/patient-app/src/lib/insightcore/api.ts

import type { LadyCenterInsightResponse } from './types';

export type InsightTone = 'info' | 'good' | 'attention';

export type InsightCoreInsight = {
  id: string;
  tone: InsightTone;
  title: string;
  summary: string;
  why?: string;
  next?: string;
  createdAtISO?: string;
  source?: string;
};

export type InsightListRequest = {
  context: string;
  mode?: string;
  dateISO?: string;
  limit?: number;
  signals?: Record<string, unknown>;
};

export type InsightFeedbackVerdict = 'helpful' | 'not_helpful' | 'not_relevant' | 'dismissed';

export type InsightFeedbackRequest = {
  context: string;
  insightId: string;
  verdict: InsightFeedbackVerdict;
  reason?: string;
  actionTaken?: string;
  meta?: Record<string, unknown>;
};

export type PatientInsightResponse = {
  requestId: string;
  generatedAt: string;
  degradedMode: boolean;
  source: 'insightcore';
  summary: {
    riskLabel: string;
    riskLevel: 'low' | 'watch' | 'moderate' | 'high' | 'critical';
    healthScore?: number | null;
    confidence?: number | null;
    requiresClinicianReview?: boolean;
  };
  concerns: Array<{ name: string; prob?: number | null }>;
  recommendations: string[];
  explanations: Array<{ feature: string; impact?: number | null; note?: string | null }>;
  trendSummary?: { label: string; note?: string } | null;
  baselineSummary?: { label: string; note?: string } | null;
  nextBestActions: Array<{
    id: string;
    label: string;
    href?: string;
    kind: 'self_care' | 'book_visit' | 'repeat_check' | 'urgent_help';
  }>;
  whenToSeekCare?: { urgency: 'routine' | 'soon' | 'urgent'; message: string } | null;
  handoffAvailable?: boolean;
};

export type LadyCenterInsightRequest = {
  mode: string;
  todayISO: string;

  prediction?: {
    cycleDay?: number | null;
    cycleLength?: number | null;
    nextPeriodStart?: string | null;
    fertileStart?: string | null;
    fertileEnd?: string | null;
    ovulation?: string | null;
    fertileWindowConfidence?: number | null;
    irregular?: boolean | null;
  } | null;

  pregnancy?: {
    status?: string | null;
    confidence?: number | null;
    reasons?: string[];
  } | null;

  screeningItems?: Array<{
    key: string;
    title: string;
    status: 'due' | 'ok' | 'overdue' | 'unknown';
    nextDueISO?: string | null;
  }>;

  documents?: Array<{
    id: string;
    title: string;
    tag: string;
    createdISO: string;
  }>;

  carePaths?: Array<{ key: string; title: string }>;

  signals?: Record<string, unknown>;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  ''
).replace(/\/+$/, '');

function getUid(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ambulant_uid') || '';
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const uid = getUid();

  return {
    ...(extra || {}),
    'x-role': 'patient',
    ...(uid ? { 'x-uid': uid } : {}),
  };
}

function apiUrl(path: string) {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_APIGW_BASE_or_GATEWAY_ORIGIN_required_for_insightcore');
  }

  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapInsights(payload: any): InsightCoreInsight[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as InsightCoreInsight[];
  if (Array.isArray(payload.insights)) return payload.insights as InsightCoreInsight[];
  if (payload.ok && Array.isArray(payload.data)) return payload.data as InsightCoreInsight[];
  if (payload.ok && Array.isArray(payload.insights)) return payload.insights as InsightCoreInsight[];
  return [];
}

async function requireOk(response: Response, label: string): Promise<any> {
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      payload?.details?.message ||
      `${label}_failed_with_status_${response.status}`;

    throw new Error(String(message));
  }

  return payload;
}

export async function listInsightCoreInsights(req: InsightListRequest): Promise<InsightCoreInsight[]> {
  const response = await fetch(apiUrl('/api/insightcore/insights'), {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(req),
    cache: 'no-store',
  });

  const payload = await requireOk(response, 'insightcore_insights');
  return unwrapInsights(payload);
}

export async function postInsightCoreFeedback(req: InsightFeedbackRequest): Promise<boolean> {
  const response = await fetch(apiUrl('/api/insightcore/feedback'), {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(req),
    cache: 'no-store',
  });

  if (!response.ok) {
    await requireOk(response, 'insightcore_feedback');
  }

  return true;
}

export async function analyzeSelfCheckWithInsightCore(input: any): Promise<PatientInsightResponse> {
  const response = await fetch(apiUrl('/api/insightcore/patient/self-check'), {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  return requireOk(response, 'insightcore_self_check') as Promise<PatientInsightResponse>;
}

export async function analyzeLadyCenterWithInsightCore(
  input: LadyCenterInsightRequest,
): Promise<LadyCenterInsightResponse> {
  const response = await fetch(apiUrl('/api/insightcore/patient/lady-center'), {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  return requireOk(response, 'insightcore_lady_center') as Promise<LadyCenterInsightResponse>;
}

export async function postInsightLearningEvent(input: any): Promise<boolean> {
  const response = await fetch(apiUrl('/api/insightcore/learning/events'), {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!response.ok) {
    await requireOk(response, 'insightcore_learning_event');
  }

  return true;
}