'use client';
import React from 'react';

export type TabsItem<T extends string = string> = { key: T; label: string };

export function Tabs<T extends string>({
  active,
  onChange,
  items,
  className,
}: {
  active: T;
  onChange: (k: T) => void;
  items: TabsItem<T>[];
  className?: string;
}) {
  return (
    <div className={`bg-white border rounded ${className || ''}`}>
      <div className="flex gap-1 p-1">
        {items.map((it) => {
          const is = it.key === active;
          return (
            <button
              key={String(it.key)}
              onClick={() => onChange(it.key)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                is ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100 border'
              }`}
              aria-pressed={is}
              title={it.label}
              aria-label={it.label}
              type="button"
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
