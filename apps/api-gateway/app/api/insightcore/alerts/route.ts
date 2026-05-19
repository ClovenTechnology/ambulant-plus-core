// apps/api-gateway/app/api/insightcore/alerts/route.ts
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

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type RiskFactors = {
  age?: number;
  gender?: string;
  vitals?: {
    hr?: number;
    spo2?: number;
    tempC?: number;
    systolic?: number;
    diastolic?: number;
    glucoseInstabilityScore?: number;
  };
  conditions?: string[];
  lifestyle?: {
    avgStepsPerDay?: number;
    sleepHours?: number;
    stressScore0to10?: number;
    hydrationGlassesPerDay?: number;
    activityMinutesPerWeek?: number;
    medicationAdherencePct?: number;
  };
};

type AlertPayload = {
  id: string;
  orgId: string;
  patientId?: string | null;
  patientName?: string | null;
  clinicianId?: string | null;
  type: string;
  source: string;
  title: string;
  message: string;
  riskScore: number;
  severity: AlertSeverity;
  ts: string;
  tags?: string[];
  factors?: RiskFactors;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonObject(value: unknown): Record<string, any> | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isPlainObject(value) ? value : null;
}

function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function defaultConfig(): InsightThresholdConfig {
  return {
    heartRate: { min: 50, max: 120 },
    spo2: { min: 92 },
    temperature: { max: 38 },
    glucoseInstability: { threshold: 0.7 },
    bp: { systolicMax: 140, diastolicMax: 90 },
    riskScoring: {
      alertScoreMin: 0.65,
      criticalScoreMin: 0.85,
      ageBands: { lt40: 0.8, '40_64': 1.0, gte65: 1.2 },
      genderModifiers: { female: 1.0, male: 1.0, other: 1.0 },
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
}

async function loadConfig(orgId: string): Promise<InsightThresholdConfig> {
  const fallback = defaultConfig();

  const ev = await prisma.runtimeEvent.findFirst({
    where: { kind: 'insight.config.thresholds', orgId },
    orderBy: { ts: 'desc' },
  });

  const p = safeJsonObject(ev?.payload);
  if (!p) return fallback;

  return {
    heartRate: {
      ...fallback.heartRate,
      ...(isPlainObject(p.heartRate) ? p.heartRate : {}),
    },
    spo2: {
      ...fallback.spo2,
      ...(isPlainObject(p.spo2) ? p.spo2 : {}),
    },
    temperature: {
      ...fallback.temperature,
      ...(isPlainObject(p.temperature) ? p.temperature : {}),
    },
    glucoseInstability: {
      ...fallback.glucoseInstability,
      ...(isPlainObject(p.glucoseInstability) ? p.glucoseInstability : {}),
    },
    bp: {
      ...fallback.bp,
      ...(isPlainObject(p.bp) ? p.bp : {}),
    },
    riskScoring: {
      ...fallback.riskScoring,
      ...(isPlainObject(p.riskScoring) ? p.riskScoring : {}),
    },
  };
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function computeRiskScore(
  factors: RiskFactors | undefined,
  cfg: InsightThresholdConfig,
): number {
  if (!factors) return 0;

  const vitals = factors.vitals || {};
  const lifestyle = factors.lifestyle || {};
  const conditions = new Set((factors.conditions || []).map((c) => c.toLowerCase()));
  const rs = cfg.riskScoring || { alertScoreMin: 0.65 };

  let score = 0;

  if (typeof vitals.hr === 'number') {
    if (vitals.hr < cfg.heartRate.min || vitals.hr > cfg.heartRate.max) {
      const delta =
        vitals.hr < cfg.heartRate.min
          ? (cfg.heartRate.min - vitals.hr) / 40
          : (vitals.hr - cfg.heartRate.max) / 40;

      score += 0.15 + Math.min(0.15, Math.abs(delta));
    }
  }

  if (typeof vitals.spo2 === 'number' && vitals.spo2 < cfg.spo2.min) {
    const drop = (cfg.spo2.min - vitals.spo2) / 10;
    score += 0.2 + Math.min(0.2, drop);
  }

  if (typeof vitals.tempC === 'number' && vitals.tempC > cfg.temperature.max) {
    const delta = (vitals.tempC - cfg.temperature.max) / 2;
    score += 0.1 + Math.min(0.2, delta);
  }

  if (
    typeof vitals.systolic === 'number' &&
    typeof vitals.diastolic === 'number' &&
    (vitals.systolic > cfg.bp.systolicMax || vitals.diastolic > cfg.bp.diastolicMax)
  ) {
    const sysDelta = Math.max(0, vitals.systolic - cfg.bp.systolicMax) / 40;
    const diaDelta = Math.max(0, vitals.diastolic - cfg.bp.diastolicMax) / 20;
    score += 0.15 + Math.min(0.2, sysDelta + diaDelta);
  }

  if (
    typeof vitals.glucoseInstabilityScore === 'number' &&
    vitals.glucoseInstabilityScore >= cfg.glucoseInstability.threshold
  ) {
    const over = vitals.glucoseInstabilityScore - cfg.glucoseInstability.threshold;
    score += 0.15 + Math.min(0.2, over);
  }

  let multiplier = 1;
  const age = factors.age;
  const ageBands = rs.ageBands || { lt40: 0.8, '40_64': 1.0, gte65: 1.2 };

  if (typeof age === 'number') {
    if (age < 40) multiplier *= ageBands.lt40;
    else if (age < 65) multiplier *= ageBands['40_64'];
    else multiplier *= ageBands.gte65;
  }

  if (factors.gender && rs.genderModifiers) {
    const key = factors.gender.toLowerCase();
    if (rs.genderModifiers[key] != null) multiplier *= rs.genderModifiers[key]!;
  }

  if (rs.conditionWeights) {
    for (const [condition, weight] of Object.entries(rs.conditionWeights)) {
      if (conditions.has(condition.toLowerCase())) {
        multiplier *= weight;
      }
    }
  }

  const lifestyleWeights = rs.lifestyleWeights || {
    sedentary: 1.2,
    poorSleep: 1.15,
    highStress: 1.15,
    lowHydration: 1.05,
    nonAdherence: 1.3,
  };

  if (
    typeof lifestyle.avgStepsPerDay === 'number' &&
    lifestyle.avgStepsPerDay < 5000
  ) {
    multiplier *= lifestyleWeights.sedentary;
  }

  if (
    typeof lifestyle.activityMinutesPerWeek === 'number' &&
    lifestyle.activityMinutesPerWeek < 90
  ) {
    multiplier *= lifestyleWeights.sedentary;
  }

  if (typeof lifestyle.sleepHours === 'number' && lifestyle.sleepHours < 6) {
    multiplier *= lifestyleWeights.poorSleep;
  }

  if (
    typeof lifestyle.stressScore0to10 === 'number' &&
    lifestyle.stressScore0to10 >= 7
  ) {
    multiplier *= lifestyleWeights.highStress;
  }

  if (
    typeof lifestyle.hydrationGlassesPerDay === 'number' &&
    lifestyle.hydrationGlassesPerDay < 5
  ) {
    multiplier *= lifestyleWeights.lowHydration;
  }

  if (
    typeof lifestyle.medicationAdherencePct === 'number' &&
    lifestyle.medicationAdherencePct > 0 &&
    lifestyle.medicationAdherencePct < 80
  ) {
    multiplier *= lifestyleWeights.nonAdherence;
  }

  return clamp01(score * multiplier);
}

function classifySeverity(score: number, cfg: InsightThresholdConfig): AlertSeverity {
  const riskScoring = cfg.riskScoring || {
    alertScoreMin: 0.65,
    criticalScoreMin: 0.85,
  };

  const lowThreshold = riskScoring.alertScoreMin || 0.65;
  const criticalThreshold =
    riskScoring.criticalScoreMin || Math.max(0.85, lowThreshold + 0.15);

  if (score >= criticalThreshold) return 'critical';
  if (score >= criticalThreshold - 0.1) return 'high';
  if (score >= lowThreshold) return 'moderate';
  return 'low';
}

function getOrgId(req: Request): string {
  return safeString(req.headers.get('x-org-id'), 'org-default');
}

function parseRiskFactors(value: unknown): RiskFactors | undefined {
  if (!isPlainObject(value)) return undefined;

  return {
    age: typeof value.age === 'number' ? value.age : undefined,
    gender: typeof value.gender === 'string' ? value.gender : undefined,
    vitals: isPlainObject(value.vitals) ? value.vitals : undefined,
    conditions: Array.isArray(value.conditions) ? value.conditions.map(String) : undefined,
    lifestyle: isPlainObject(value.lifestyle) ? value.lifestyle : undefined,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = getOrgId(req);

  const patientId = url.searchParams.get('patientId') || undefined;
  const clinicianId = url.searchParams.get('clinicianId') || undefined;
  const rawLimit = Number(url.searchParams.get('limit') || '20');
  const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 20));
  const sinceIso = url.searchParams.get('since') || undefined;

  const where: any = {
    kind: { startsWith: 'insight.alert' },
    orgId,
  };

  if (patientId) {
    where.OR = [{ targetPatientId: patientId }, { patientId }];
  }

  if (clinicianId) {
    where.OR = where.OR
      ? [...where.OR, { targetClinicianId: clinicianId }, { clinicianId }]
      : [{ targetClinicianId: clinicianId }, { clinicianId }];
  }

  if (sinceIso) {
    const ms = Date.parse(sinceIso);
    if (Number.isFinite(ms)) {
      where.ts = { gte: BigInt(ms) };
    }
  }

  const events = await prisma.runtimeEvent.findMany({
    where,
    orderBy: { ts: 'desc' },
    take: limit,
  });

  const alerts: AlertPayload[] = [];

  for (const ev of events) {
    const payload = safeJsonObject(ev.payload);
    if (!payload) continue;

    alerts.push({
      id: safeString(payload.id, ev.id),
      orgId: safeString(payload.orgId, orgId),
      patientId: safeStringOrNull(payload.patientId) ?? ev.patientId ?? null,
      patientName: safeStringOrNull(payload.patientName),
      clinicianId: safeStringOrNull(payload.clinicianId) ?? ev.clinicianId ?? null,
      type: safeString(payload.type, 'multifactor'),
      source: safeString(payload.source, 'insightcore'),
      title: safeString(payload.title, 'InsightCore alert'),
      message: safeString(payload.message, ''),
      riskScore: typeof payload.riskScore === 'number' ? clamp01(payload.riskScore) : 0,
      severity: ['low', 'moderate', 'high', 'critical'].includes(String(payload.severity))
        ? (payload.severity as AlertSeverity)
        : 'low',
      ts: safeString(payload.ts, new Date(Number(ev.ts)).toISOString()),
      tags: safeStringArray(payload.tags),
      factors: parseRiskFactors(payload.factors),
    });
  }

  return new Response(JSON.stringify({ alerts }), {
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request) {
  const orgId = getOrgId(req);
  const body = safeJsonObject(await req.json().catch(() => ({}))) || {};

  const now = Date.now();
  const id = safeString(body.id, crypto.randomUUID());
  const patientId = safeStringOrNull(body.patientId);
  const clinicianId = safeStringOrNull(body.clinicianId);

  const factors = parseRiskFactors(body.factors);
  const cfg = await loadConfig(orgId);

  const riskScore =
    typeof body.riskScore === 'number'
      ? clamp01(body.riskScore)
      : computeRiskScore(factors, cfg);

  const severity = classifySeverity(riskScore, cfg);

  const payload: AlertPayload = {
    id,
    orgId,
    patientId: patientId ?? undefined,
    patientName: safeStringOrNull(body.patientName),
    clinicianId: clinicianId ?? undefined,
    type: safeString(body.type, 'multifactor'),
    source: safeString(body.source, 'insightcore'),
    title: safeString(body.title, safeString(body.type, 'InsightCore alert')),
    message: safeString(body.message, safeString(body.note, '')),
    riskScore,
    severity,
    ts: new Date(now).toISOString(),
    tags: safeStringArray(body.tags),
    factors,
  };

  await prisma.runtimeEvent.create({
    data: {
      id,
      ts: BigInt(now),
      kind: 'insight.alert.multifactor',
      encounterId: safeStringOrNull(body.encounterId),
      patientId,
      clinicianId,
      payload: JSON.stringify(payload),
      targetPatientId: patientId,
      targetClinicianId: clinicianId,
      targetAdmin: true,
      orgId,
    },
  });

  return new Response(JSON.stringify({ ok: true, alert: payload }), {
    headers: { 'content-type': 'application/json' },
  });
}