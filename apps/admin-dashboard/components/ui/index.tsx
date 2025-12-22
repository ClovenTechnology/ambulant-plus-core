import * as React from 'react';

/* -------------------- Card (light mode) -------------------- */

export function Card({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        'rounded-xl border border-slate-200 bg-white shadow-sm ' + className
      }
      {...props}
    />
  );
}

/* -------------------- Badge (light mode) -------------------- */

type BadgeTone = 'default' | 'success' | 'warning' | 'danger';
type BadgeSize = 'xs' | 'sm';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
}

export function Badge({
  tone = 'default',
  size = 'sm',
  className = '',
  ...props
}: BadgeProps) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={
        'inline-flex items-center rounded-full border font-medium ' +
        sizeClasses +
        ' ' +
        toneClasses +
        ' ' +
        className
      }
      {...props}
    />
  );
}

/* -------------------- Tabs (if you still need a simple one) -------------------- */
/* If you already have Tabs elsewhere, keep that one instead of this. */

type TabDef = { value: string; label: string };

interface TabsProps {
  value: string;
  onChange?: (value: string) => void;
  tabs: TabDef[];
  className?: string;
}

export function Tabs({ value, onChange, tabs, className = '' }: TabsProps) {
  return (
    <div
      className={
        'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs ' +
        className
      }
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange?.(t.value)}
            className={
              'rounded-full px-3 py-1 transition ' +
              (active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
