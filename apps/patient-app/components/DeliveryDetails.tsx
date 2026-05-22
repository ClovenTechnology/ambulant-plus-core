// apps/patient-app/components/DeliveryDetails.tsx
'use client';

import React from 'react';

export type DeliveryDetailsProps = {
  orderNo?: string;
  eRxNo?: string;
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
  caseId?: string;
  sessionId?: string;
  trackingNo?: string;
  riderId?: string;
  bikeReg?: string;
  deliveryAmount?: number | string;
  paymentMethod?: 'Card' | 'Medical Aid' | 'Cash' | string;
  dateIso?: string;
  fulfillment?: string;
  status?: string;
};

function clean(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatWhen(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={mono ? 'mt-1 break-all font-mono text-xs font-semibold text-slate-800' : 'mt-1 text-sm font-semibold text-slate-900'}>
        {value || '—'}
      </div>
    </div>
  );
}

export default function DeliveryDetails({ order }: { order: DeliveryDetailsProps }) {
  const d = order || {};
  const payment = [d.paymentMethod, d.deliveryAmount].filter(Boolean).join(' · ') || '—';
  const rider = [d.riderId, d.bikeReg ? `Vehicle ${d.bikeReg}` : ''].filter(Boolean).join(' · ') || 'Pending assignment';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">CarePort order</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
            {clean(d.orderNo)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tracking {clean(d.trackingNo)}
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {clean(d.status || d.fulfillment, 'In progress')}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailRow label="eRx" value={clean(d.eRxNo)} mono />
        <DetailRow label="Encounter" value={clean(d.encounterId)} mono />
        <DetailRow label="Patient" value={clean(d.patientId)} mono />
        <DetailRow label="Clinician" value={clean(d.clinicianId)} mono />
        <DetailRow label="Rider / vehicle" value={rider} />
        <DetailRow label="Payment" value={payment} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Ordered: <span className="font-semibold text-slate-900">{formatWhen(d.dateIso)}</span>
      </div>
    </section>
  );
}
