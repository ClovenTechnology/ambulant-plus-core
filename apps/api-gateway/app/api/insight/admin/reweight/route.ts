// apps/api-gateway/app/api/insight/admin/reweight/route.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Modality = 'steth' | 'ecg' | 'ppg' | 'image' | 'other';

function inferModality(m: string): Modality {
  const k = (m || '').toLowerCase();
  if (k === 'steth') return 'steth';
  if (k === 'ecg') return 'ecg';
  if (k === 'ppg') return 'ppg';
  if (k === 'image') return 'image';
  if (k === 'other') return 'other';
  // allow passing raw kind strings too
  if (k.includes('steth') || k.includes('pcm')) return 'steth';
  if (k.includes('ecg')) return 'ecg';
  if (k.includes('ppg')) return 'ppg';
  if (k.includes('image') || k.includes('otoscope') || k.includes('photo') || k.includes('video')) return 'image';
  return 'other';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(s?: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function bumpVersion(prev?: string | null) {
  const v = (prev || '').trim();
  const m = /^v(\d+)$/.exec(v);
  if (m) return `v${Number(m[1]) + 1}`;
  if (v) return `${v}-next`;
  return 'v1';
}

function isAdmin(req: Request) {
  // Accept either x-role=admin OR Bearer ADMIN_API_KEY
  const role = (req.headers.get('x-role') || '').toLowerCase();
  if (role === 'admin') return true;

  const auth = req.headers.get('authorization') || '';
  const key = process.env.ADMIN_API_KEY || '';
  if (key && auth === `Bearer ${key}`) return true;

  return false;
}

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const orgId = body?.orgId ? String(body.orgId) : 'org-default';
  const modality = inferModality(String(body?.modality || 'ecg'));
  const sinceHours = Number(body?.sinceHours ?? 24 * 7); // default 7 days
  const minFeedback = Number(body?.minFeedback ?? 3);

  const now = Date.now();
  const windowStart = now - Math.max(1, sinceHours) * 60 * 60 * 1000;

  const feedbackKind = `insight.feedback.${modality}`;

  const feedbackEvents = await prisma.runtimeEvent.findMany({
    where: {
      kind: feedbackKind,
      ts: { gte: BigInt(windowStart) },
      orgId,
    },
    orderBy: { ts: 'desc' },
    take: 5000,
  });

  const rows = feedbackEvents
    .map((e) => safeJsonParse(e.payload))
    .filter(Boolean) as Array<{
    predictionId: string;
    modality: string;
    isCorrect: boolean;
    originalLabel?: string | null;
    correctedLabel?: string | null;
    comment?: string | null;
    ts: number;
  }>;

  if (rows.length < minFeedback) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'insufficient_feedback',
        detail: `Need at least ${minFeedback} feedback items, got ${rows.length}.`,
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // Compute per-label accuracy based on originalLabel
  const perLabel: Record<
    string,
    { total: number; correct: number; incorrect: number; correctedTo: Record<string, number> }
  > = {};

  let total = 0;
  let correct = 0;

  for (const r of rows) {
    const label = (r.originalLabel || 'unknown').toString();
    if (!perLabel[label]) perLabel[label] = { total: 0, correct: 0, incorrect: 0, correctedTo: {} };

    perLabel[label].total += 1;
    total += 1;

    if (r.isCorrect) {
      perLabel[label].correct += 1;
      correct += 1;
    } else {
      perLabel[label].incorrect += 1;
      const to = (r.correctedLabel || 'unknown').toString();
      perLabel[label].correctedTo[to] = (perLabel[label].correctedTo[to] || 0) + 1;
    }
  }

  const accuracy = total ? correct / total : 0;

  // Build weights: accuracy 0 → 0.6, accuracy 1 → 1.4 (tunable, QA-friendly)
  const weights: Record<string, number> = {};
  for (const [label, s] of Object.entries(perLabel)) {
    const a = s.total ? s.correct / s.total : 0;
    weights[label] = clamp(0.6 + 0.8 * a, 0.6, 1.4);
  }

  // Load previous model version (if exists)
  const prev = await prisma.runtimeEvent.findFirst({
    where: { kind: `insight.model.reweighted.${modality}`, orgId },
    orderBy: { ts: 'desc' },
  });
  const prevPayload = safeJsonParse(prev?.payload);
  const parentVersion = prevPayload?.modelVersion ? String(prevPayload.modelVersion) : 'v0-demo';
  const modelVersion = bumpVersion(parentVersion);

  const eventPayload = {
    modality,
    modelVersion,
    parentVersion,
    createdAt: new Date(now).toISOString(),
    windowStartTs: windowStart,
    windowEndTs: now,
    feedbackCount: rows.length,
    metrics: {
      total,
      correct,
      accuracy,
      perLabel,
    },
    weights,
  };

  await prisma.runtimeEvent.create({
    data: {
      id: crypto.randomUUID(),
      ts: BigInt(now),
      kind: `insight.model.reweighted.${modality}`,
      payload: JSON.stringify(eventPayload),
      targetAdmin: true,
      orgId,
    },
  });

  // Also refresh in-memory cache used by /api/insight/frame
  // (Best-effort; frame route still has its own cache TTL.)
  try {
    // @ts-ignore
    global.__INSIGHT_MODEL_CACHE__ = global.__INSIGHT_MODEL_CACHE__ || {};
    // @ts-ignore
    global.__INSIGHT_MODEL_CACHE__[`${orgId}:${modality}`] = { fetchedAt: now, modelVersion, weights };
  } catch {}

  return new Response(JSON.stringify({ ok: true, modality, modelVersion, parentVersion, weights, metrics: eventPayload.metrics }), {
    headers: { 'content-type': 'application/json' },
  });
}
