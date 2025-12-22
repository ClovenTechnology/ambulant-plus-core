'use client';

import React from 'react';

export type StatusLegendVariant = 'careport' | 'medreach' | 'generic';

type StatusLegendProps = {
  variant?: StatusLegendVariant;
  className?: string;
  compact?: boolean;
};

type LegendItem = {
  key: string;
  label: string;
  description: string;
  color: string;
};

const BASE: LegendItem[] = [
  {
    key: 'pending',
    label: 'Pending',
    description: 'Order created; not yet dispatched / scheduled.',
    color: 'bg-gray-100 text-gray-700',
  },
  {
    key: 'in-progress',
    label: 'In progress',
    description: 'Rider / phlebotomist is actively working on the job.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    key: 'done',
    label: 'Done',
    description: 'Job completed successfully (delivered / collected).',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    key: 'failed',
    label: 'Failed',
    description: 'Job failed or was cancelled; needs manual attention.',
    color: 'bg-rose-50 text-rose-700',
  },
];

const CAREPORT_EXTRA: LegendItem[] = [
  {
    key: 'out-for-delivery',
    label: 'Out for delivery',
    description: 'Rider has collected from pharmacy and is en route.',
    color: 'bg-indigo-50 text-indigo-700',
  },
];

const MEDREACH_EXTRA: LegendItem[] = [
  {
    key: 'sample-collected',
    label: 'Sample collected',
    description: 'Phlebotomist has collected the specimen from patient.',
    color: 'bg-teal-50 text-teal-700',
  },
];

export default function StatusLegend({
  variant = 'generic',
  className,
  compact = false,
}: StatusLegendProps) {
  let items: LegendItem[] = [...BASE];

  if (variant === 'careport') {
    items = [...BASE, ...CAREPORT_EXTRA];
  } else if (variant === 'medreach') {
    items = [...BASE, ...MEDREACH_EXTRA];
  }

  if (compact) {
    return (
      <div
        className={
          className ??
          'flex flex-wrap items-center gap-1 text-[10px] text-gray-500'
        }
      >
        <span className="font-medium text-[11px] mr-1">Legend:</span>
        {items.map((it) => (
          <span
            key={it.key}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-gray-200 bg-white`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                it.key === 'pending'
                  ? 'bg-gray-400'
                  : it.key === 'in-progress'
                  ? 'bg-blue-500'
                  : it.key === 'done'
                  ? 'bg-emerald-500'
                  : it.key === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-indigo-500'
              }`}
            />
            <span>{it.label}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <section
      className={
        className ??
        'border rounded-lg bg-white p-3 text-xs text-gray-600 space-y-2'
      }
    >
      <div className="font-medium text-gray-800">Status legend</div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.key} className="flex items-start gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${it.color}`}
            >
              {it.label}
            </span>
            <span className="text-[11px] text-gray-500">{it.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
