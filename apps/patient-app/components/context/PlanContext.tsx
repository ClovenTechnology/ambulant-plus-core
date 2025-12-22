// apps/patient-app/components/context/PlanContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Plan } from '../../lib/plans';
import { getEffectivePlan, loadEntitlements, maybeActivatePremiumCreditWhenEligible } from '../../lib/entitlements';

type Ctx = {
  plan: Plan;               // base subscription plan (free/premium/family)
  effectivePlan: Plan;      // includes promos/entitlements
  isPremium: boolean;       // true for premium OR family OR active entitlement
  setPlan: (p: Plan) => void;
  refreshEntitlements: () => void;
};

const PlanCtx = createContext<Ctx | null>(null);
const LS_KEY = 'ambulant.plan';

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<Plan>('free');
  const [entTick, setEntTick] = useState(0);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(LS_KEY) || 'free') as Plan;
      setPlanState(saved === 'premium' || saved === 'family' ? saved : 'free');
    } catch {}
  }, []);

  // Keep in sync if another tab redeems / updates entitlements
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key) return;
      if (e.key === 'ambulant.entitlements.v1' || e.key === LS_KEY) setEntTick((n) => n + 1);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refreshEntitlements = () => setEntTick((n) => n + 1);

  const setPlan = (p: Plan) => {
    const next = p === 'premium' || p === 'family' ? p : 'free';
    setPlanState(next);
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {}

    // If user leaves Family and has Premium credit, auto-activate it.
    const res = maybeActivatePremiumCreditWhenEligible(next);
    if (res.didActivate) refreshEntitlements();
  };

  const effectivePlan = useMemo(() => {
    const ent = loadEntitlements();
    return getEffectivePlan(plan, ent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, entTick]);

  const value = useMemo<Ctx>(
    () => ({
      plan,
      effectivePlan,
      isPremium: effectivePlan === 'premium' || effectivePlan === 'family',
      setPlan,
      refreshEntitlements,
    }),
    [plan, effectivePlan]
  );

  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanCtx);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}
