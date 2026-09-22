// apps/patient-app/lib/entitlements.ts
import type { Plan } from './plans';

export type PatientPlanEntitlement = {
  patientId: string;
  persisted: boolean;
  plan: Plan;
  configuredPlan: Plan;
  cycle: 'monthly' | 'annual' | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  premiumCreditDays: number;
  familyCreditDays: number;
  sourceType: string;
  sourceRef: string | null;
  orgId: string;
  updatedAt: string | null;
};

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizePlan(value: unknown): Plan {
  const raw = clean(value, 32).toLowerCase();
  if (raw === 'family') return 'family';
  if (raw === 'premium') return 'premium';
  return 'free';
}

function normalizeCycle(
  value: unknown,
): PatientPlanEntitlement['cycle'] {
  const raw = clean(value, 32).toLowerCase();
  if (raw === 'monthly' || raw === 'annual') return raw;
  return null;
}

function nonNegativeInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function nullableText(value: unknown, max = 240) {
  const text = clean(value, max);
  return text || null;
}

export function parsePatientPlanEntitlement(
  payload: unknown,
): PatientPlanEntitlement | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const raw =
    root.entitlement && typeof root.entitlement === 'object'
      ? (root.entitlement as Record<string, unknown>)
      : root;

  const patientId = clean(raw.patientId, 180);
  if (!patientId) return null;

  return {
    patientId,
    persisted: raw.persisted === true,
    plan: normalizePlan(raw.plan),
    configuredPlan: normalizePlan(raw.configuredPlan ?? raw.plan),
    cycle: normalizeCycle(raw.cycle),
    status: clean(raw.status, 80) || 'inactive',
    startsAt: nullableText(raw.startsAt, 80),
    endsAt: nullableText(raw.endsAt, 80),
    premiumCreditDays: nonNegativeInt(raw.premiumCreditDays),
    familyCreditDays: nonNegativeInt(raw.familyCreditDays),
    sourceType: clean(raw.sourceType, 120) || 'system',
    sourceRef: nullableText(raw.sourceRef, 240),
    orgId: clean(raw.orgId, 120) || 'org-default',
    updatedAt: nullableText(raw.updatedAt, 80),
  };
}
