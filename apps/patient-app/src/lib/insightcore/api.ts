// apps/patient-app/src/lib/insightcore/api.ts
export type InsightTone = 'info' | 'good' | 'attention';

export type InsightCoreInsight = {
  id: string;
  tone: InsightTone;
  title: string;
  summary: string;
  why?: string;
  next?: string;
  createdAtISO?: string;
  // optional metadata, safe to ignore if API doesn’t send it
  source?: string;
};

export type InsightListRequest = {
  context: string; // e.g. "lady_center"
  mode?: string; // "cycle" | "symptoms" | ...
  dateISO?: string; // YYYY-MM-DD
  limit?: number;

  // optional signals/context (your API can ignore any unknown fields)
  signals?: Record<string, unknown>;
};

export type InsightFeedbackVerdict = 'helpful' | 'not_helpful' | 'not_relevant' | 'dismissed';

export type InsightFeedbackRequest = {
  context: string; // "lady_center"
  insightId: string;
  verdict: InsightFeedbackVerdict;

  // optional extras
  reason?: string;
  actionTaken?: string;
  meta?: Record<string, unknown>;
};

const API_BASE = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

function getUid(): string {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    const uuid =
      (globalThis.crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2);
    v = `${uuid}-u`;
    localStorage.setItem(key, v);
  }
  return v;
}

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

export async function listInsightCoreInsights(req: InsightListRequest): Promise<InsightCoreInsight[]> {
  const uid = getUid();

  // Prefer POST so you can send richer context without querystring pain.
  const postUrl = `${API_BASE}/api/insightcore/insights`;
  try {
    const r = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-role': 'patient',
        'x-uid': uid,
      },
      body: JSON.stringify(req),
      cache: 'no-store',
    });

    if (r.ok) {
      const payload = await readJsonSafe(r);
      return unwrapInsights(payload);
    }
  } catch {
    // fall through to GET attempt
  }

  // Fallback GET (in case your API is GET-based today)
  const qs = new URLSearchParams();
  if (req.context) qs.set('context', req.context);
  if (req.mode) qs.set('mode', req.mode);
  if (req.dateISO) qs.set('date', req.dateISO);
  if (typeof req.limit === 'number') qs.set('limit', String(req.limit));

  const getUrl = `${API_BASE}/api/insightcore/insights?${qs.toString()}`;
  const r2 = await fetch(getUrl, {
    method: 'GET',
    headers: {
      'x-role': 'patient',
      'x-uid': uid,
    },
    cache: 'no-store',
  });

  if (!r2.ok) return [];
  const payload2 = await readJsonSafe(r2);
  return unwrapInsights(payload2);
}

export async function postInsightCoreFeedback(req: InsightFeedbackRequest): Promise<boolean> {
  const uid = getUid();
  const url = `${API_BASE}/api/insightcore/feedback`;

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-role': 'patient',
      'x-uid': uid,
    },
    body: JSON.stringify(req),
    cache: 'no-store',
  });

  return r.ok;
}
