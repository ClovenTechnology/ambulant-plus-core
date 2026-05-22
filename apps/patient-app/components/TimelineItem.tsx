// apps/patient-app/components/TimelineItem.tsx
'use client';

import React from 'react';

type TimelineEntity = 'pharmacy' | 'rider' | 'system' | string;

type TimelineItemData = {
  t?: string | number;
  msg?: string;
  lat?: number;
  lng?: number;
  entity?: TimelineEntity;
  place?: string;
  [key: string]: any;
};

type Props = {
  it: TimelineItemData;
  onCenter?: (lat: number, lng: number) => void;
};

function entityLabel(entity?: TimelineEntity) {
  if (entity === 'pharmacy') return 'Pharmacy';
  if (entity === 'rider') return 'Rider';
  return 'System';
}

function entityTone(entity?: TimelineEntity) {
  if (entity === 'pharmacy') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (entity === 'rider') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatTime(value?: string | number) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value?: string | number) {
  if (!value) return 'Unknown time';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown time';
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TimelineItem({ it, onCenter }: Props) {
  const entity: TimelineEntity = it?.entity || 'system';
  const hasCoords = typeof it?.lat === 'number' && typeof it?.lng === 'number';

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-3 w-3 rounded-full bg-slate-900 ring-4 ring-slate-100" aria-hidden />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${entityTone(entity)}`}>
                {entityLabel(entity)}
              </span>
              <span className="text-xs font-medium text-slate-400">{formatTime(it?.t)}</span>
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-950">
              {it?.msg || 'CarePort update'}
            </p>

            {it?.place ? (
              <p className="mt-1 text-xs text-slate-500">{it.place}</p>
            ) : hasCoords ? (
              <p className="mt-1 font-mono text-xs text-slate-500">
                {it.lat!.toFixed(5)}, {it.lng!.toFixed(5)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
          <div className="text-xs text-slate-500">{formatDateTime(it?.t)}</div>

          {hasCoords && onCenter ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onCenter(it.lat!, it.lng!)}
            >
              Open map
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
