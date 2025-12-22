// apps/patient-app/components/plan/PlanGate.tsx
'use client';

import React from 'react';
import type { Plan } from '../../lib/plans';
import { hasAccess, planMeta } from '../../lib/plans';
import { usePlan } from '../context/PlanContext';
import { usePlanModal } from './PlanModalProvider';

export default function PlanGate(props: { required: Plan; feature: string; children: React.ReactNode; className?: string }) {
  const { required, feature, children, className = '' } = props;
  const { plan } = usePlan();
  const { openPlanModal } = usePlanModal();

  if (hasAccess(plan, required)) return <>{children}</>;

  const meta = planMeta(required);

  return (
    <div className={['relative rounded-2xl border border-white/10 bg-white/5', className].join(' ')}>
      <div className="p-4 opacity-60 blur-[1px] pointer-events-none select-none">{children}</div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-[#0b1224]/90 backdrop-blur p-4 shadow-2xl">
          <div className="text-sm font-semibold text-slate-50">{feature}</div>
          <div className="text-xs text-slate-300 mt-1">
            Requires <span className="font-semibold">{meta.name}</span>.
          </div>

          <button
            onClick={() =>
              openPlanModal({
                required,
                feature,
                reason: `Upgrade to ${meta.name} to unlock this.`,
              })
            }
            className="mt-3 w-full rounded-xl px-3 py-2 text-sm text-slate-900 bg-white hover:bg-white/90"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
