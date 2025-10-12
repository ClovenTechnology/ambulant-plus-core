'use client';

import React from 'react';
import Link from 'next/link';

export type TimelineStatus = 'pending' | 'in-progress' | 'done' | 'failed';

export type TimelineItem = {
  id: string;
  /** ISO string or Date */
  when: string | Date;
  /** Primary label (e.g., “Rx #284273 shipped”) */
  title: string;
  /** Optional secondary line */
  description?: string;
  /** Small right-aligned metadata (e.g., price, location) */
  meta?: string;
  /** Visual state chip */
  status?: TimelineStatus;
  /** Optional deep-link */
  href?: string;
};

export function Timeline({
  items,
  emptyText = 'Nothing to show yet.',
  compact = false,
}: {
  items: TimelineItem[];
  emptyText?: string;
  compact?: boolean;
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="text-sm text-gray-500">{emptyText}</div>;
  }

  const chip = (s?: TimelineStatus) => {
    const cls =
      s === 'done'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : s === 'in-progress'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : s === 'failed'
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : 'bg-gray-50 text-gray-700 border-gray-200';
    return (
      <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
        {s ?? 'pending'}
      </span>
    );
  };

  const fmt = (w: string | Date) =>
    new Date(w).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <ol className="relative ml-3">
      {/* spine */}
      <div className="absolute left-[-1px] top-0 bottom-0 w-0.5 bg-gray-200 rounded-full" />
      {items.map((it, i) => (
        <li key={it.id} className="relative pl-6 pb-4">
          {/* node */}
          <span
            className={`absolute left-[-6px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
              it.status === 'done'
                ? 'bg-emerald-600'
                : it.status === 'in-progress'
                ? 'bg-amber-600'
                : it.status === 'failed'
                ? 'bg-rose-600'
                : 'bg-gray-400'
            }`}
          />
          <div className={`flex items-start ${compact ? 'gap-3' : 'gap-4'}`}>
            <div className="min-w-[130px] text-xs text-gray-500">{fmt(it.when)}</div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="leading-5">
                  {it.href ? (
                    <Link href={it.href} className="font-medium text-slate-900 underline decoration-indigo-600/40">
                      {it.title}
                    </Link>
                  ) : (
                    <div className="font-medium text-slate-900">{it.title}</div>
                  )}
                  {it.description ? <div className="text-sm text-gray-600">{it.description}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  {it.meta ? <div className="text-xs text-gray-500">{it.meta}</div> : null}
                  {chip(it.status)}
                </div>
              </div>
            </div>
          </div>
          {/* tail cap */}
          {i === items.length - 1 ? (
            <span className="absolute left-[-1px] bottom-0 translate-y-1/2 h-2 w-0.5 bg-white" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export default Timeline;
