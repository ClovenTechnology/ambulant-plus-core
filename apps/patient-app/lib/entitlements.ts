// apps/patient-app/lib/entitlements.ts
import type { Plan } from './plans';

export type EntitlementPlan = Exclude<Plan, 'free'>; // 'premium' | 'family'

export type EntitlementsState = {
  active?: {
    plan: EntitlementPlan;
    endsAtISO: string; // inclusive-ish; we treat as expires after this moment
    source?: 'promo' | 'purchase' | 'admin' | 'other';
    note?: string;
  } | null;
  credits?: {
    premiumDays?: number; // used when user is on Family (or when Premium is already covered)
  } | null;
  updatedAtISO?: string;
};

const LS_KEY = 'ambulant.entitlements.v1';

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function loadEntitlements(): EntitlementsState {
  if (typeof window === 'undefined') return {};
  const raw = safeParse<EntitlementsState>(localStorage.getItem(LS_KEY));
  return pruneExpired(raw || {});
}

export function saveEntitlements(state: EntitlementsState) {
  if (typeof window === 'undefined') return;
  const next: EntitlementsState = {
    ...state,
    updatedAtISO: new Date().toISOString(),
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
}

export function pruneExpired(state: EntitlementsState, nowMs = Date.now()): EntitlementsState {
  const s: EntitlementsState = { ...state };
  const active = s.active ?? null;
  if (active?.endsAtISO) {
    const t = Date.parse(active.endsAtISO);
    if (!Number.isFinite(t) || t <= nowMs) s.active = null;
  }
  if (!s.credits) s.credits = {};
  if (typeof s.credits.premiumDays !== 'number' || s.credits.premiumDays < 0) s.credits.premiumDays = 0;
  return s;
}

export function getEffectivePlan(basePlan: Plan, state: EntitlementsState, nowMs = Date.now()): Plan {
  const s = pruneExpired(state, nowMs);
  if (basePlan === 'family') return 'family';
  if (basePlan === 'premium') return 'premium';
  if (s.active?.plan && Date.parse(s.active.endsAtISO) > nowMs) return s.active.plan;
  return 'free';
}

function addDays(iso: string, days: number) {
  const t = Date.parse(iso);
  const base = Number.isFinite(t) ? t : Date.now();
  const next = base + Math.max(0, Math.round(days)) * 24 * 60 * 60 * 1000;
  return new Date(next).toISOString();
}

export function applyRedemption(params: {
  basePlan: Plan;
  redeemedPlan: EntitlementPlan; // 'premium'|'family'
  days: number;                 // e.g. 30 / 90
  source?: EntitlementsState['active'] extends infer X
    ? X extends { source?: infer Y }
      ? Y
      : never
    : never;
}): { next: EntitlementsState; kind: 'activated' | 'extended' | 'credited'; message: string } {
  const { basePlan, redeemedPlan, days } = params;
  const current = loadEntitlements(); // always operate on freshest LS copy
  const state = pruneExpired(current);

  const effective = getEffectivePlan(basePlan, state);

  // ✅ Rule: if user has Family and redeems Premium → treat as credit
  if (effective === 'family' && redeemedPlan === 'premium') {
    const prev = state.credits?.premiumDays ?? 0;
    const nextDays = prev + Math.max(0, Math.round(days));
    state.credits = { ...(state.credits || {}), premiumDays: nextDays };
    saveEntitlements(state);
    return {
      next: state,
      kind: 'credited',
      message: `Added ${days} days of Premium credit. It will activate automatically when you’re no longer on Family.`,
    };
  }

  // Otherwise: activate or extend an entitlement
  const nowISO = new Date().toISOString();
  const active = state.active ?? null;

  if (active && active.plan === redeemedPlan) {
    // extend existing same-plan entitlement
    const baseISO = active.endsAtISO && Date.parse(active.endsAtISO) > Date.now() ? active.endsAtISO : nowISO;
    const nextISO = addDays(baseISO, days);
    state.active = { ...active, endsAtISO: nextISO, source: params.source || active.source || 'promo' };
    saveEntitlements(state);
    return {
      next: state,
      kind: 'extended',
      message: `Extended your ${redeemedPlan === 'premium' ? 'Premium' : 'Family'} access by ${days} days.`,
    };
  }

  // Replace active with redeemed plan (simple, predictable)
  state.active = {
    plan: redeemedPlan,
    endsAtISO: addDays(nowISO, days),
    source: params.source || 'promo',
  };
  saveEntitlements(state);

  return {
    next: state,
    kind: 'activated',
    message: `${redeemedPlan === 'premium' ? 'Premium' : 'Family'} unlocked for ${days} days.`,
  };
}

/**
 * Optional convenience: if user leaves Family and has Premium credit,
 * auto-activate Premium entitlement from the credit bucket.
 */
export function maybeActivatePremiumCreditWhenEligible(basePlan: Plan): { didActivate: boolean; message?: string } {
  const state = pruneExpired(loadEntitlements());
  const effective = getEffectivePlan(basePlan, state);

  // Only auto-activate if user is not already Premium/Family and has credit
  if (effective !== 'free') return { didActivate: false };

  const creditDays = state.credits?.premiumDays ?? 0;
  if (creditDays <= 0) return { didActivate: false };

  const nowISO = new Date().toISOString();
  state.active = {
    plan: 'premium',
    endsAtISO: addDays(nowISO, creditDays),
    source: 'promo',
    note: 'Activated from Premium credit',
  };
  state.credits = { ...(state.credits || {}), premiumDays: 0 };
  saveEntitlements(state);

  return { didActivate: true, message: `Premium credit activated (${creditDays} days).` };
}
