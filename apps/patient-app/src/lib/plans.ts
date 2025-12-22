// apps/patient-app/src/lib/plans.ts

export type Plan = 'free' | 'premium' | 'family';

export const PLAN_ORDER: Plan[] = ['free', 'premium', 'family'];

export type PlanMeta = {
  key: Plan;
  name: string;
  badge: string;
  priceMonthlyZar: number; // mock pricing (replace later)
  tagline: string;
  bullets: string[];
  maxMembers?: number; // for family
};

export const PATIENT_PLANS: PlanMeta[] = [
  {
    key: 'free',
    name: 'Free',
    badge: 'Free',
    priceMonthlyZar: 0,
    tagline: 'Basics for everyday tracking',
    bullets: [
      'Core vitals dashboard',
      'Basic insights',
      'Limited exports',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    badge: 'Premium',
    priceMonthlyZar: 99,
    tagline: 'Unlock advanced features',
    bullets: [
      'Sensitive-hide mode across the app',
      'Advanced insights + exports',
      'Premium clinician filters & comparisons',
      'Priority support',
    ],
  },
  {
    key: 'family',
    name: 'Family',
    badge: 'Family',
    priceMonthlyZar: 179,
    tagline: 'One plan for the household',
    bullets: [
      'Everything in Premium',
      'Up to 5 family members',
      'Shared care circle & emergency contacts',
      'Family vitals summaries',
    ],
    maxMembers: 5,
  },
];

export function planRank(p: Plan): number {
  const i = PLAN_ORDER.indexOf(p);
  return i === -1 ? 0 : i;
}

export function hasAccess(current: Plan, required: Plan): boolean {
  return planRank(current) >= planRank(required);
}

export function planMeta(plan: Plan): PlanMeta {
  return PATIENT_PLANS.find(p => p.key === plan) ?? PATIENT_PLANS[0];
}

export const PLAN_COOKIE = 'ambulant_plan';
export const PLAN_LS_KEY = 'ambulant.plan';
