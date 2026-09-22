// apps/patient-app/components/context/PlanContext.tsx
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Plan } from '../../lib/plans';
import {
  parsePatientPlanEntitlement,
  type PatientPlanEntitlement,
} from '../../lib/entitlements';

type Ctx = {
  plan: Plan;
  effectivePlan: Plan;
  isPremium: boolean;
  entitlement: PatientPlanEntitlement | null;
  loading: boolean;
  error: string | null;
  setPlan: (p: Plan) => void;
  refreshEntitlements: () => Promise<PatientPlanEntitlement | null>;
};

const PlanCtx = createContext<Ctx | null>(null);

export function PlanProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entitlement, setEntitlement] =
    useState<PatientPlanEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEntitlements = useCallback(async () => {
    setLoading(true);

    const response = await fetch('/api/plan/entitlement', {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    }).catch(() => null);

    if (!response) {
      setEntitlement(null);
      setError('entitlement_unavailable');
      setLoading(false);
      return null;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      setEntitlement(null);
      setError(
        response.status === 401
          ? null
          : String(payload?.error || 'entitlement_unavailable'),
      );
      setLoading(false);
      return null;
    }

    const next = parsePatientPlanEntitlement(payload);

    if (!next) {
      setEntitlement(null);
      setError('invalid_entitlement_response');
      setLoading(false);
      return null;
    }

    setEntitlement(next);
    setError(null);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);

  useEffect(() => {
    const refresh = () => {
      void refreshEntitlements();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshEntitlements]);

  const effectivePlan: Plan = entitlement?.plan ?? 'free';

  // Compatibility surface only. Browser callers cannot set plan authority.
  const setPlan = useCallback(
    (_p: Plan) => {
      void refreshEntitlements();
    },
    [refreshEntitlements],
  );

  const value = useMemo<Ctx>(
    () => ({
      plan: effectivePlan,
      effectivePlan,
      isPremium:
        effectivePlan === 'premium' || effectivePlan === 'family',
      entitlement,
      loading,
      error,
      setPlan,
      refreshEntitlements,
    }),
    [
      effectivePlan,
      entitlement,
      loading,
      error,
      setPlan,
      refreshEntitlements,
    ],
  );

  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanCtx);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}
