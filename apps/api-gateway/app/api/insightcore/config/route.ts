// apps/api-gateway/app/api/insightcore/config/route.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InsightThresholdConfig = {
  heartRate: { min: number; max: number };
  spo2: { min: number };
  temperature: { max: number };
  glucoseInstability: { threshold: number };
  bp: { systolicMax: number; diastolicMax: number };
  riskScoring: {
    alertScoreMin: number;
    criticalScoreMin?: number;
    ageBands?: { lt40: number; '40_64': number; gte65: number };
    genderModifiers?: Record<string, number>;
    conditionWeights?: Record<string, number>;
    lifestyleWeights?: {
      sedentary: number;
      poorSleep: number;
      highStress: number;
      lowHydration: number;
      nonAdherence: number;
    };
  };
};

const DEFAULT_CONFIG: InsightThresholdConfig = {
  heartRate: { min: 50, max: 120 },
  spo2: { min: 92 },
  temperature: { max: 38 },
  glucoseInstability: { threshold: 0.7 },
  bp: { systolicMax: 140, diastolicMax: 90 },
  riskScoring: {
    alertScoreMin: 0.65,
    criticalScoreMin: 0.85,
    ageBands: { lt40: 0.8, '40_64': 1.0, gte65: 1.2 },
    genderModifiers: {
      female: 1.0,
      male: 1.0,
      other: 1.0,
    },
    conditionWeights: {
      diabetes: 1.3,
      hypertension: 1.25,
      heartFailure: 1.4,
      renalDisease: 1.35,
      pregnancy: 1.3,
    },
    lifestyleWeights: {
      sedentary: 1.2,
      poorSleep: 1.15,
      highStress: 1.15,
      lowHydration: 1.05,
      nonAdherence: 1.3,
    },
  },
};

function safeJsonParse(s?: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getOrgId(req: Request): string {
  // You can improve this later to resolve from session / auth middleware.
  return (req.headers.get('x-org-id') || 'org-default').toString();
}

async function loadConfig(orgId: string): Promise<InsightThresholdConfig & { updatedAt?: string; updatedBy?: string | null }> {
  const ev = await prisma.runtimeEvent.findFirst({
    where: { kind: 'insight.config.thresholds', orgId },
    orderBy: { ts: 'desc' },
  });

  if (!ev?.payload) return DEFAULT_CONFIG;

  const p = safeJsonParse(ev.payload) || {};
  const cfg: InsightThresholdConfig = {
    ...DEFAULT_CONFIG,
    ...p,
    heartRate: { ...DEFAULT_CONFIG.heartRate, ...(p.heartRate || {}) },
    spo2: { ...DEFAULT_CONFIG.spo2, ...(p.spo2 || {}) },
    temperature: { ...DEFAULT_CONFIG.temperature, ...(p.temperature || {}) },
    glucoseInstability: { ...DEFAULT_CONFIG.glucoseInstability, ...(p.glucoseInstability || {}) },
    bp: { ...DEFAULT_CONFIG.bp, ...(p.bp || {}) },
    riskScoring: { ...DEFAULT_CONFIG.riskScoring, ...(p.riskScoring || {}) },
  };

  return {
    ...cfg,
    updatedAt: (p.updatedAt as string | undefined) ?? undefined,
    updatedBy: (p.updatedBy as string | undefined) ?? undefined,
  };
}

export async function GET(req: Request) {
  const orgId = getOrgId(req);
  const cfg = await loadConfig(orgId);
  return new Response(JSON.stringify(cfg), {
    headers: { 'content-type': 'application/json' },
  });
}

export async function PUT(req: Request) {
  const orgId = getOrgId(req);
  const body = (await req.json().catch(() => ({}))) as Partial<InsightThresholdConfig & { updatedBy?: string }>;

  const cfg: InsightThresholdConfig = {
    ...DEFAULT_CONFIG,
    ...body,
    heartRate: { ...DEFAULT_CONFIG.heartRate, ...(body.heartRate || {}) },
    spo2: { ...DEFAULT_CONFIG.spo2, ...(body.spo2 || {}) },
    temperature: { ...DEFAULT_CONFIG.temperature, ...(body.temperature || {}) },
    glucoseInstability: { ...DEFAULT_CONFIG.glucoseInstability, ...(body.glucoseInstability || {}) },
    bp: { ...DEFAULT_CONFIG.bp, ...(body.bp || {}) },
    riskScoring: { ...DEFAULT_CONFIG.riskScoring, ...(body.riskScoring || {}) },
  };

  const now = Date.now();
  const payload = {
    ...cfg,
    updatedAt: new Date(now).toISOString(),
    updatedBy: body.updatedBy || null,
  };

  await prisma.runtimeEvent.create({
    data: {
      id: crypto.randomUUID(),
      ts: BigInt(now),
      kind: 'insight.config.thresholds',
      payload: JSON.stringify(payload),
      targetAdmin: true,
      orgId,
    },
  });

  return new Response(JSON.stringify({ ok: true, updatedAt: payload.updatedAt }), {
    headers: { 'content-type': 'application/json' },
  });
}
