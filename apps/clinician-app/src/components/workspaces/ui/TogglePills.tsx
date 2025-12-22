'use client';

import React from 'react';

export function TogglePills<T extends string>({
  value,
  onChange,
  items,
  counts,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ key: T; label: string }>;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex gap-2">
      {items.map((it) => {
        const active = it.key === value;
        const c = counts?.[it.key];
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={
              'flex-1 rounded-lg border px-3 py-2 text-sm font-medium relative ' +
              (active
                ? 'border-blue-300 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800')
            }
            aria-pressed={active}
          >
            {it.label}
            {typeof c === 'number' && c > 0 ? (
              <span className="absolute -top-1 -right-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5">
                {c}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
