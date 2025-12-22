// apps/patient-app/components/plan/PlanBadge.tsx
'use client';

import React from 'react';
import type { Plan } from '../../lib/plans';
import { hasAccess, planMeta } from '../../lib/plans';
import { usePlan } from '../context/PlanContext';
import { usePlanModal } from './PlanModalProvider';

export default function PlanBadge(props: { required: Plan; feature?: string; className?: string }) {
  const { required, feature, className = '' } = props;
  const { plan } = usePlan();
  const { openPlanModal } = usePlanModal();

  const locked = !hasAccess(plan, required);
  if (!locked) return null;

  const meta = planMeta(required);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openPlanModal({
          required,
          feature: feature ?? 'Premium feature',
          reason: `Upgrade to ${meta.name} to unlock this — or redeem a code if you have one.`,
        });
      }}
      className={[
        'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 hover:bg-slate-50',
        'px-2.5 py-1 text-[11px] text-slate-700 shadow-sm backdrop-blur',
        className,
      ].join(' ')}
      title={`${meta.name} required`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
      <span className="font-semibold">{meta.badge}</span>
    </button>
  );
}
