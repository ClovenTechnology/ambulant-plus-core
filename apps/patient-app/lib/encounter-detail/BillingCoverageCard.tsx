// apps/patient-app/components/encounter-detail/BillingCoverageCard.tsx
'use client';

import React from 'react';
import { coverageTextFrom, formatAmount } from '@/lib/encounter-detail/display';

type CoverageInfo = {
  type?: 'Card' | 'Medical Aid' | 'Voucher' | 'Cash' | string;
  name?: string;
  scheme?: string;
  last4?: string;
  reference?: string;
};

type BillingInfo = {
  currency?: string;
  totalAmount?: number;
  coveredAmount?: number;
  patientAmount?: number;
  status?: 'Pending' | 'Paid' | 'Refunded' | 'Failed' | string;
  invoiceId?: string;
};

export default function BillingCoverageCard({
  coverage,
  billing,
}: {
  coverage?: CoverageInfo | null;
  billing?: BillingInfo | null;
}) {
  const coverageText = coverageTextFrom(coverage);
  const currency = billing?.currency ?? null;

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Billing & coverage</div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Payment overview</h3>
        </div>

        {billing?.status ? (
          <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-900/10">
            {billing.status}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricTile label="Total amount" value={formatAmount(billing?.totalAmount, currency)} />
        <MetricTile label="Covered amount" value={formatAmount(billing?.coveredAmount, currency)} />
        <MetricTile label="Your cost" value={formatAmount(billing?.patientAmount, currency)} />
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <div>
          <span className="font-medium text-slate-900">Coverage:</span>{' '}
          <span>{coverageText || '—'}</span>
        </div>
        <div>
          <span className="font-medium text-slate-900">Invoice:</span>{' '}
          <span>{billing?.invoiceId || '—'}</span>
        </div>
      </div>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}