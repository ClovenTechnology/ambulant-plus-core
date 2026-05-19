'use client';

import React from 'react';

export type TrendWatchAlert = {
  id: string;
  tone: 'rose' | 'amber' | 'sky' | 'emerald';
  title: string;
  detail: string;
};

type TrendWatchAlertsProps = {
  alerts: TrendWatchAlert[];
  discreet: boolean;
};

export default function TrendWatchAlerts(props: TrendWatchAlertsProps) {
  const { alerts, discreet } = props;

  if (!alerts.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Trend watch</div>
            <div className="mt-1 text-xs text-slate-500">
              Lightweight watches generated from your trend surface.
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            No watches
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600">
          {discreet
            ? 'Trend watches are hidden while Discreet is enabled.'
            : 'No simple watch conditions are active in the selected range.'}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Trend watch</div>
          <div className="mt-1 text-xs text-slate-500">
            Explainable signals from current trend direction and recent points.
          </div>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {alerts.length} active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} discreet={discreet} />
        ))}
      </div>
    </div>
  );
}

function AlertCard(props: { alert: TrendWatchAlert; discreet: boolean }) {
  const { alert, discreet } = props;

  const tone =
    alert.tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : alert.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : alert.tone === 'sky'
      ? 'border-sky-200 bg-sky-50 text-sky-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-sm font-semibold">{alert.title}</div>
      <div className="mt-2 text-sm leading-6">
        {discreet ? 'Hidden in Discreet mode.' : alert.detail}
      </div>
    </div>
  );
}