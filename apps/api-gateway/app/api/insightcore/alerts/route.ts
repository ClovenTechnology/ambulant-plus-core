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

// Factors that can feed into the risk engine
type RiskFactors = {
  age?: number;
  gender?: string;
  vitals?: {
    hr?: number;
    spo2?: number;
    tempC?: number;
    systolic?: number;
    diastolic?: number;
    glucoseInstabilityScore?: number; // 0–1
  };
  conditions?: string[]; // e.g. ['diabetes', 'hypertension']
  lifestyle?: {
    avgStepsPerDay?: number;
    sleepHours?: number;
    stressScore0to10?: number;
    hydrationGlassesPerDay?: number;
    activityMinutesPerWeek?: number;
    medicationAdherencePct?: number; // 0–100
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
  riskScore: number; // 0–1
  severity: AlertSeverity;
  ts: string;
  tags?: string[];
  factors?: RiskFactors;
};

function safeJsonParse(s?: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function loadConfig(orgId: string): Promise<InsightThresholdConfig> {
  const ev = await prisma.runtimeEvent.findFirst({
    where: { kind: 'insight.config.thresholds', orgId },
    orderBy: { ts: 'desc' },
  });

  if (!ev?.payload) {
    // Mirror defaults in /insightcore/config route
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

  const p = safeJsonParse(ev.payload) || {};
  return {
    heartRate: { min: 50, max: 120, ...(p.heartRate || {}) },
    spo2: { min: 92, ...(p.spo2 || {}) },
    temperature: { max: 38, ...(p.temperature || {}) },
    glucoseInstability: { threshold: 0.7, ...(p.glucoseInstability || {}) },
    bp: { systolicMax: 140, diastolicMax: 90, ...(p.bp || {}) },
    riskScoring: {
      alertScoreMin: 0.65,
      criticalScoreMin: 0.85,
      ...(p.riskScoring || {}),
    },
  };
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Very lightweight multi-factor risk engine – you can tune weights later.
function computeRiskScore(factors: RiskFactors | undefined, cfg: InsightThresholdConfig): number {
  if (!factors) return 0;

  const vitals = factors.vitals || {};
  const lifestyle = factors.lifestyle || {};
  const conditions = new Set((factors.conditions || []).map((c) => c.toLowerCase()));
  const rs = cfg.riskScoring || { alertScoreMin: 0.65 };

  let score = 0;

  // Vitals contributions (each roughly adds 0–0.3)
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
    const drop = (cfg.spo2.min - vitals.spo2) / 10; // 5% drop → 0.5
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

  if (typeof vitals.glucoseInstabilityScore === 'number') {
    if (vitals.glucoseInstabilityScore >= cfg.glucoseInstability.threshold) {
      const over = vitals.glucoseInstabilityScore - cfg.glucoseInstability.threshold;
      score += 0.15 + Math.min(0.2, over);
    }
  }

  // Age band multiplier
  let multiplier = 1;
  const age = factors.age;
  const ageBands = rs.ageBands || { lt40: 0.8, '40_64': 1.0, gte65: 1.2 };
  if (typeof age === 'number') {
    if (age < 40) multiplier *= ageBands.lt40;
    else if (age < 65) multiplier *= ageBands['40_64'];
    else multiplier *= ageBands.gte65;
  }

  // Gender modifier
  if (factors.gender && rs.genderModifiers) {
    const key = factors.gender.toLowerCase();
    if (rs.genderModifiers[key] != null) multiplier *= rs.genderModifiers[key]!;
  }

  // Condition-based bumps
  if (rs.conditionWeights) {
    for (const [cond, w] of Object.entries(rs.conditionWeights)) {
      if (conditions.has(cond.toLowerCase())) {
        multiplier *= w;
      }
    }
  }

  // Lifestyle factors
  const lw = rs.lifestyleWeights || {
    sedentary: 1.2,
    poorSleep: 1.15,
    highStress: 1.15,
    lowHydration: 1.05,
    nonAdherence: 1.3,
  };

  if (typeof lifestyle.avgStepsPerDay === 'number' && lifestyle.avgStepsPerDay < 5000) {
    multiplier *= lw.sedentary;
  }

  if (typeof lifestyle.activityMinutesPerWeek === 'number' && lifestyle.activityMinutesPerWeek < 90) {
    multiplier *= lw.sedentary;
  }

  if (typeof lifestyle.sleepHours === 'number' && lifestyle.sleepHours < 6) {
    multiplier *= lw.poorSleep;
  }

  if (typeof lifestyle.stressScore0to10 === 'number' && lifestyle.stressScore0to10 >= 7) {
    multiplier *= lw.highStress;
  }

  if (typeof lifestyle.hydrationGlassesPerDay === 'number' && lifestyle.hydrationGlassesPerDay < 5) {
    multiplier *= lw.lowHydration;
  }

  if (
    typeof lifestyle.medicationAdherencePct === 'number' &&
    lifestyle.medicationAdherencePct > 0 &&
    lifestyle.medicationAdherencePct < 80
  ) {
    multiplier *= lw.nonAdherence;
  }

  const raw = score * multiplier;
  return clamp01(raw);
}

function classifySeverity(score: number, cfg: InsightThresholdConfig): AlertSeverity {
  const rs = cfg.riskScoring || { alertScoreMin: 0.65, criticalScoreMin: 0.85 };
  const lowThreshold = rs.alertScoreMin || 0.65;
  const criticalThreshold = rs.criticalScoreMin || Math.max(0.85, lowThreshold + 0.15);

  if (score >= criticalThreshold) return 'critical';
  if (score >= criticalThreshold - 0.1) return 'high';
  if (score >= lowThreshold) return 'moderate';
  return 'low';
}

function getOrgId(req: Request): string {
  return (req.headers.get('x-org-id') || 'org-default').toString();
}

/* ---------- GET: fetch alerts for patient / clinician / admin ---------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = getOrgId(req);

  const patientId = url.searchParams.get('patientId') || undefined;
  const clinicianId = url.searchParams.get('clinicianId') || undefined;
  const limit = Number(url.searchParams.get('limit') || '20');
  const sinceIso = url.searchParams.get('since') || undefined;

  const where: any = {
    kind: { startsWith: 'insight.alert' },
    orgId,
  };

  if (patientId) {
    where.OR = [
      { targetPatientId: patientId },
      { patientId },
    ];
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
    take: Math.max(1, Math.min(100, limit)),
  });

  const alerts: AlertPayload[] = [];
  for (const ev of events) {
    const p = safeJsonParse(ev.payload);
    if (!p) continue;

    alerts.push({
      id: p.id || ev.id,
      orgId: p.orgId || orgId,
      patientId: p.patientId ?? ev.patientId ?? null,
      patientName: p.patientName ?? null,
      clinicianId: p.clinicianId ?? ev.clinicianId ?? null,
      type: p.type || 'multifactor',
      source: p.source || 'insightcore',
      title: p.title || 'InsightCore alert',
      message: p.message || '',
      riskScore: typeof p.riskScore === 'number' ? p.riskScore : 0,
      severity: (p.severity as AlertSeverity) || 'low',
      ts: p.ts || new Date(Number(ev.ts)).toISOString(),
      tags: Array.isArray(p.tags) ? p.tags : [],
      factors: p.factors || undefined,
    });
  }

  return new Response(JSON.stringify({ alerts }), {
    headers: { 'content-type': 'application/json' },
  });
}

/* ---------- POST: create alert (from InsightCore engine or simulator) ---------- */

export async function POST(req: Request) {
  const orgId = getOrgId(req);
  const body = (await req.json().catch(() => ({}))) as any;

  const now = Date.now();
  const id = body.id || crypto.randomUUID();
  const patientId = body.patientId ? String(body.patientId) : null;
  const clinicianId = body.clinicianId ? String(body.clinicianId) : null;

  const factors: RiskFactors | undefined = body.factors || undefined;
  const cfg = await loadConfig(orgId);

  let riskScore: number;
  if (typeof body.riskScore === 'number') {
    riskScore = clamp01(body.riskScore);
  } else {
    riskScore = computeRiskScore(factors, cfg);
  }

  const severity = classifySeverity(riskScore, cfg);

  const payload: AlertPayload = {
    id,
    orgId,
    patientId: patientId ?? undefined,
    patientName: body.patientName || null,
    clinicianId: clinicianId ?? undefined,
    type: body.type || 'multifactor',
    source: body.source || 'insightcore',
    title: body.title || body.type || 'InsightCore alert',
    message: body.message || body.note || '',
    riskScore,
    severity,
    ts: new Date(now).toISOString(),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    factors,
  };

  await prisma.runtimeEvent.create({
    data: {
      id,
      ts: BigInt(now),
      kind: 'insight.alert.multifactor',
      encounterId: body.encounterId ? String(body.encounterId) : null,
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
