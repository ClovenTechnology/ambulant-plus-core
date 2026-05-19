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
  source: 'insightcore' | 'local_fallback' | 'hybrid';
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

/* =========================================================
   Lady Center InsightCore Request
========================================================= */

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

/* =========================================================
   Config
========================================================= */

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
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/* =========================================================
   Helpers
========================================================= */

async function readJsonSafe(r: Response): Promise<any> {
  const text = await r.text();
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

/* =========================================================
   APIs
========================================================= */

export async function listInsightCoreInsights(req: InsightListRequest): Promise<InsightCoreInsight[]> {
  const postUrl = apiUrl('/api/insightcore/insights');

  try {
    const r = await fetch(postUrl, {
      method: 'POST',
      headers: authHeaders({
      'content-type': 'application/json',
    }),
      body: JSON.stringify(req),
      cache: 'no-store',
    });

    if (r.ok) {
      const payload = await readJsonSafe(r);
      return unwrapInsights(payload);
    }
  } catch {}

  const qs = new URLSearchParams();
  if (req.context) qs.set('context', req.context);
  if (req.mode) qs.set('mode', req.mode);
  if (req.dateISO) qs.set('date', req.dateISO);
  if (typeof req.limit === 'number') qs.set('limit', String(req.limit));

  const getUrl = apiUrl(`/api/insightcore/insights?${qs.toString()}`);
  const r2 = await fetch(getUrl, {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });

  if (!r2.ok) return [];
  const payload2 = await readJsonSafe(r2);
  return unwrapInsights(payload2);
}

export async function postInsightCoreFeedback(req: InsightFeedbackRequest): Promise<boolean> {
  const url = apiUrl('/api/insightcore/feedback');

  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(req),
    cache: 'no-store',
  });

  return r.ok;
}

export async function analyzeSelfCheckWithInsightCore(input: any): Promise<PatientInsightResponse> {
  const url = apiUrl('/api/insightcore/patient/self-check');

  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!r.ok) throw new Error('InsightCore self-check failed');
  return r.json();
}

/* =========================================================
   NEW: Lady Center InsightCore API
========================================================= */

export async function analyzeLadyCenterWithInsightCore(
  input: LadyCenterInsightRequest
): Promise<LadyCenterInsightResponse> {
  const url = apiUrl('/api/insightcore/patient/lady-center');

  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!r.ok) throw new Error('InsightCore lady-center failed');
  return r.json();
}

export async function postInsightLearningEvent(input: any): Promise<boolean> {
  const url = apiUrl('/api/insightcore/learning/events');

  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  return r.ok;
}