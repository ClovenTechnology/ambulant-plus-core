// apps/api-gateway/src/lib/patient-plan-entitlement.ts
import { prisma } from '@/src/lib/prisma';

export type PatientPlan = 'free' | 'premium' | 'family';
export type PatientBillingCycle = 'monthly' | 'annual' | null;

export type PatientPlanEntitlementState = {
  patientId: string;
  persisted: boolean;
  plan: PatientPlan;
  configuredPlan: PatientPlan;
  cycle: PatientBillingCycle;
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

function clean(value: unknown, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizePlan(value: unknown): PatientPlan {
  const raw = clean(value, 32).toLowerCase();
  if (raw === 'family') return 'family';
  if (raw === 'premium') return 'premium';
  return 'free';
}

function normalizeCycle(value: unknown): PatientBillingCycle {
  const raw = clean(value, 32).toLowerCase();
  if (raw === 'monthly' || raw === 'annual') return raw;
  return null;
}

function iso(value: Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : null;
}

function defaultState(patientId: string): PatientPlanEntitlementState {
  return {
    patientId,
    persisted: false,
    plan: 'free',
    configuredPlan: 'free',
    cycle: null,
    status: 'active',
    startsAt: null,
    endsAt: null,
    premiumCreditDays: 0,
    familyCreditDays: 0,
    sourceType: 'system_default',
    sourceRef: null,
    orgId: 'org-default',
    updatedAt: null,
  };
}

export async function readPatientPlanEntitlement(
  patientId: string,
  now = new Date(),
): Promise<PatientPlanEntitlementState> {
  const subject = clean(patientId, 180);
  if (!subject) throw new Error('patient_id_required');

  const row = await prisma.patientPlanEntitlement.findUnique({
    where: { patientId: subject },
  });

  if (!row) return defaultState(subject);

  const configuredPlan = normalizePlan(row.plan);
  const storedStatus = clean(row.status, 80).toLowerCase() || 'inactive';

  const hasStarted = !row.startsAt || row.startsAt.getTime() <= now.getTime();
  const hasNotEnded = !row.endsAt || row.endsAt.getTime() > now.getTime();
  const active = storedStatus === 'active' && hasStarted && hasNotEnded;

  const effectiveStatus =
    storedStatus !== 'active'
      ? storedStatus
      : !hasStarted
        ? 'scheduled'
        : !hasNotEnded
          ? 'expired'
          : 'active';

  return {
    patientId: subject,
    persisted: true,
    plan: active ? configuredPlan : 'free',
    configuredPlan,
    cycle: normalizeCycle(row.cycle),
    status: effectiveStatus,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    premiumCreditDays: Math.max(0, row.premiumCreditDays || 0),
    familyCreditDays: Math.max(0, row.familyCreditDays || 0),
    sourceType: clean(row.sourceType, 120) || 'system',
    sourceRef: clean(row.sourceRef, 240) || null,
    orgId: clean(row.orgId, 120) || 'org-default',
    updatedAt: iso(row.updatedAt),
  };
}