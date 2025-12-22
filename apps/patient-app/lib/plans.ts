// apps/patient-app/lib/plans.ts
export type Plan = 'free' | 'premium' | 'family';

export const PLAN_COOKIE = 'ambulant.plan';

export type PatientPlanDef = {
  key: Plan;
  name: string;
  badge: string;
  tagline: string;
  priceMonthlyZar: number;
  bullets: string[];
};

export const PATIENT_PLANS: PatientPlanDef[] = [
  {
    key: 'free',
    name: 'Free',
    badge: 'Starter',
    tagline: 'The essentials to begin your care journey.',
    priceMonthlyZar: 0,
    bullets: [
      'Vitals dashboard with clean, readable trends.',
      'Basic appointments and consultation access.',
      'Reminders and daily health routines.',
      'Export basics (where available).',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    badge: 'Plus',
    tagline: 'For people who want faster access and deeper clarity.',
    priceMonthlyZar: 99,
    bullets: [
      'Deeper insights and longer history for trends and reports.',
      'Priority booking windows (where available).',
      'Enhanced exports for clinicians and follow-ups.',
      'Device-friendly experience for ongoing monitoring.',
    ],
  },
  {
    key: 'family',
    name: 'Family',
    badge: 'Household',
    tagline: 'Care that works for you and the people you look after.',
    priceMonthlyZar: 179,
    bullets: [
      'Shared care experience for a household (care coordination).',
      'Manage loved ones’ care with clarity and consent.',
      'A smoother experience for ongoing family health routines.',
      'Priority support for households (where available).',
    ],
  },
];

export function planMeta(plan: Plan) {
  return PATIENT_PLANS.find((p) => p.key === plan) ?? PATIENT_PLANS[0];
}

const PLAN_RANK: Record<Plan, number> = { free: 0, premium: 1, family: 2 };
export function hasAccess(current: Plan, required: Plan) {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[required] ?? 0);
}

export function planRank(p: Plan) {
  return PLAN_RANK[p] ?? 0;
}

export function normalizePlan(x: any): Plan | null {
  const s = String(x ?? '').toLowerCase().trim();
  if (s === 'free' || s === 'premium' || s === 'family') return s;
  return null;
}
