'use client';

import * as React from 'react';
import clsx from 'clsx';

export type TabItem = { key: string; label: string; disabled?: boolean };

export default function Tabs(props: {
  items: TabItem[];
  defaultKey?: string;
  value?: string;
  onChange?: (key: string) => void;
  className?: string;
  children: (activeKey: string) => React.ReactNode;
}) {
  const { items, defaultKey, value, onChange, className, children } = props;

  const first = items[0]?.key ?? 'tab';
  const [internal, setInternal] = React.useState(defaultKey ?? first);
  const active = value ?? internal;

  function setActive(k: string) {
    if (value == null) setInternal(k);
    onChange?.(k);
  }

  return (
    <div className={clsx('w-full', className)}>
      <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              type="button"
              disabled={it.disabled}
              onClick={() => setActive(it.key)}
              className={clsx(
                'flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition',
                it.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-95',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'bg-transparent text-slate-600'
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>

      <div className="pt-4">{children(active)}</div>
    </div>
  );
}
