// apps/patient-app/components/context/PlanContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Plan = 'free' | 'premium';

type Ctx = {
  plan: Plan;
  isPremium: boolean;
  setPlan: (p: Plan) => void;
};

const PlanCtx = createContext<Ctx | null>(null);
const LS_KEY = 'ambulant.plan';

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlanState] = useState<Plan>('free');

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(LS_KEY) || 'free') as Plan;
      setPlanState(saved === 'premium' ? 'premium' : 'free');
    } catch {}
  }, []);

  const setPlan = (p: Plan) => {
    setPlanState(p);
    try { localStorage.setItem(LS_KEY, p); } catch {}
  };

  const value = useMemo<Ctx>(() => ({ plan, isPremium: plan === 'premium', setPlan }), [plan]);

  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>;
}

/**
 * usePlan - hook to consume the Plan context.
 * Throws a helpful error if used outside the PlanProvider.
 */
export function usePlan() {
  const ctx = useContext(PlanCtx);
  if (!ctx) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return ctx;
}
