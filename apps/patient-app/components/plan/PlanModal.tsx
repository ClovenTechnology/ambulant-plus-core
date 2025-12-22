// apps/patient-app/components/plan/PlanModal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Plan } from '../../lib/plans';
import { PATIENT_PLANS, hasAccess, planMeta } from '../../lib/plans';
import { usePlan } from '../context/PlanContext';
import RedeemCodeModal from './RedeemCodeModal';

export default function PlanModal(props: {
  open: boolean;
  onClose: () => void;
  required?: Plan;
  feature?: string;
  reason?: string;
  redirectTo?: string;
}) {
  const { open, onClose, required = 'premium', feature, reason, redirectTo = '/plan/upgrade' } = props;

  const router = useRouter();
  const { plan, setPlan } = usePlan() as any; // keeps compatibility if your hook is typed differently
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [inlineMsg, setInlineMsg] = useState<string | null>(null);

  const title = feature ? `Unlock ${feature}` : 'Upgrade your plan';
  const subtitle =
    reason ??
    (feature
      ? `This feature needs ${planMeta(required).name}.`
      : 'Pick the plan that matches how you use Ambulant+ — then unlock it everywhere.');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const body = useMemo(() => {
    if (!open) return null;

    const goUpgrade = (target: Plan) => {
      const u = new URL(redirectTo, window.location.origin);
      u.searchParams.set('plan', target);
      if (feature) u.searchParams.set('feature', feature);
      u.searchParams.set('required', required);
      u.searchParams.set('back', window.location.pathname + window.location.search);
      router.push(u.pathname + '?' + u.searchParams.toString());
      onClose();
    };

    const locked = !hasAccess(plan, required);

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" role="dialog" aria-modal="true">
        <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />

        <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(2,6,23,0.20)]">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-xl">
                <div className="text-lg font-semibold tracking-tight text-slate-900">{title}</div>
                <div className="text-sm text-slate-600 mt-1 leading-6">{subtitle}</div>

                {!locked ? (
                  <div className="text-xs text-emerald-700 mt-2">
                    You already have access on your current plan.
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-2">
                    Prefer a code?{' '}
                    <button
                      type="button"
                      className="font-semibold text-slate-900 underline underline-offset-4 decoration-slate-300 hover:text-slate-700"
                      onClick={() => setRedeemOpen(true)}
                    >
                      Redeem here
                    </button>
                    .
                  </div>
                )}

                {inlineMsg ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {inlineMsg}
                  </div>
                ) : null}
              </div>

              <button
                onClick={onClose}
                className="rounded-xl px-3 py-2 text-sm bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
              >
                Close
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PATIENT_PLANS.map((p) => {
                const isCurrent = p.key === plan;

                return (
                  <div
                    key={p.key}
                    className={[
                      'rounded-2xl border p-4 bg-white shadow-sm',
                      p.key === required ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-200',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold tracking-tight text-slate-900">{p.name}</div>
                      <span className="text-[10px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                        {p.badge}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600">{p.tagline}</div>

                    <div className="mt-3 text-2xl font-semibold text-slate-900 tabular-nums">
                      {p.priceMonthlyZar === 0 ? 'R0' : `R${p.priceMonthlyZar}`}
                      <span className="text-sm text-slate-500 font-medium">/mo</span>
                    </div>

                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                      {p.bullets.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-slate-400/80" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4">
                      {isCurrent ? (
                        <div className="text-xs text-slate-700 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-center">
                          Current plan
                        </div>
                      ) : p.key === 'free' ? (
                        <button
                          onClick={onClose}
                          className="w-full rounded-xl px-3 py-2 text-sm bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
                        >
                          Stay on Free
                        </button>
                      ) : (
                        <button
                          onClick={() => goUpgrade(p.key)}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-sm"
                        >
                          View {p.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Payments are in test mode right now. Redeem codes are validated server-side.
            </div>
          </div>
        </div>

        <RedeemCodeModal
          open={redeemOpen}
          onClose={() => setRedeemOpen(false)}
          currentPlan={plan}
          onRedeemed={(data) => {
            // If it was an upgrade, reflect it immediately for gating UI.
            if (data.effect === 'upgraded') {
              const next = data.redeemed.plan === 'family' ? ('family' as Plan) : ('premium' as Plan);
              try {
                setPlan?.(next);
              } catch {}
            }
            setInlineMsg(data.message);
          }}
        />
      </div>
    );
  }, [open, onClose, router, redirectTo, feature, required, title, subtitle, plan, redeemOpen, inlineMsg, setPlan]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}
