// apps/patient-app/components/PlanBadge.tsx
'use client';

import { usePlan } from './context/PlanContext';

export default function PlanBadge() {
  const { effectivePlan, loading } = usePlan();

  const label =
    effectivePlan === 'family'
      ? 'Family'
      : effectivePlan === 'premium'
        ? 'Premium'
        : 'Free';

  const styles =
    effectivePlan === 'family'
      ? 'bg-violet-50 text-violet-700 border-violet-200'
      : effectivePlan === 'premium'
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span
      title={
        loading
          ? 'Checking your plan'
          : 'Plan verified from your Ambulant+ account'
      }
      className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${styles}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {loading ? 'Checking...' : label}
    </span>
  );
}
