import fs from 'node:fs/promises';
import path from 'node:path';
import { PATIENT_PLANS, type PatientPlanDef, type Plan } from './plans';

type RawPatientPlan = Partial<PatientPlanDef> & {
  id?: string;
  key?: string;
  label?: string;
  name?: string;
  description?: string;
  recommendedFor?: string;
  currency?: string;
  enabled?: boolean;
};

function configPathCandidates() {
  return [
    path.resolve(process.cwd(), 'packages', 'admin', 'plans.json'),
    path.resolve(process.cwd(), '..', '..', 'packages', 'admin', 'plans.json'),
    path.resolve(process.cwd(), '..', 'packages', 'admin', 'plans.json'),
  ];
}

async function readPatientPlansFromFile(): Promise<RawPatientPlan[]> {
  for (const candidate of configPathCandidates()) {
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, 'utf8'));
      if (Array.isArray(parsed?.patientPlans)) return parsed.patientPlans;
    } catch {
      // try next
    }
  }

  return [];
}

async function readPatientPlansFromGateway(): Promise<RawPatientPlan[]> {
  const gateway =
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';

  if (!gateway) return [];

  try {
    const res = await fetch(`${gateway.replace(/\/$/, '')}/api/settings/plans`, {
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    return Array.isArray(json?.patientPlans) ? json.patientPlans : [];
  } catch {
    return [];
  }
}

function normalisePrice(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function mergePatientPlans(configured: RawPatientPlan[]): PatientPlanDef[] {
  return PATIENT_PLANS.map((base) => {
    const match = configured.find((plan) => String(plan.id || plan.key || '').toLowerCase() === base.key);
    const priceMonthlyZar = normalisePrice(match?.priceMonthlyZar);

    return {
      ...base,
      name: String(match?.label || match?.name || base.name),
      tagline: String(match?.description || base.tagline),
      priceMonthlyZar,
    };
  });
}

export async function getConfiguredPatientPlans(): Promise<PatientPlanDef[]> {
  const gatewayPlans = await readPatientPlansFromGateway();
  if (gatewayPlans.length > 0) return mergePatientPlans(gatewayPlans);

  const filePlans = await readPatientPlansFromFile();
  return mergePatientPlans(filePlans);
}

export async function getConfiguredPatientPlan(plan: Plan): Promise<PatientPlanDef> {
  const plans = await getConfiguredPatientPlans();
  return plans.find((item) => item.key === plan) || plans[0];
}

export async function getConfiguredPatientPlanPriceMonthlyZar(plan: Plan): Promise<number> {
  const resolved = await getConfiguredPatientPlan(plan);
  return normalisePrice(resolved.priceMonthlyZar);
}
