// apps/patient-app/components/PlanBadge.tsx
'use client';

import { useEffect, useState } from 'react';

type Plan = 'free' | 'premium';

export default function PlanBadge() {
  const [plan, setPlan] = useState<Plan>('free');

  useEffect(() => {
    try {
      const s = localStorage.getItem('ambulant.plan');
      if (s === 'premium' || s === 'free') setPlan(s);
    } catch {}
  }, []);

  const toggle = () => {
    const next: Plan = plan === 'premium' ? 'free' : 'premium';
    setPlan(next);
    try { localStorage.setItem('ambulant.plan', next); } catch {}
  };

  const styles =
    plan === 'premium'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <button
      onClick={toggle}
      title="Click to toggle plan (free/premium)"
      className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${styles}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {plan === 'premium' ? 'Premium' : 'Free'}
    </button>
  );
}
