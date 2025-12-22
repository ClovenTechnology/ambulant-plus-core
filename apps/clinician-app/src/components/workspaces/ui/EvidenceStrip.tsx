'use client';

import React from 'react';
import type { Evidence } from '@/src/lib/workspaces/types';

export function EvidenceStrip({
  evidence,
  onSelect,
}: {
  evidence: Evidence[];
  onSelect?: (ev: Evidence) => void;
}) {
  if (!evidence.length) {
    return (
      <div className="mt-2 text-sm text-gray-600 italic">
        No evidence yet.
      </div>
    );
  }

  const pillClass = (status: Evidence['status']) => {
    if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (status === 'processing') return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-rose-200 bg-rose-50 text-rose-800';
  };

  return (
    <div className="mt-2 flex gap-2 overflow-auto pb-1">
      {evidence.map((ev) => (
        <button
          key={ev.id}
          type="button"
          className="min-w-[190px] max-w-[190px] rounded-lg border overflow-hidden bg-white text-left hover:bg-gray-50"
          onClick={() => onSelect?.(ev)}
        >
          <div className="h-24 bg-gray-100 grid place-items-center">
            <span className="text-xs text-gray-500">
              {ev.kind === 'image' ? 'Image' : 'Clip'}
            </span>
          </div>

          <div className="p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-gray-800">{ev.device}</div>
              <span className={`text-[10px] rounded-full border px-1.5 py-0.5 ${pillClass(ev.status)}`}>
                {ev.status}
              </span>
            </div>

            <div className="text-[11px] text-gray-500">
              {new Date(ev.capturedAt).toLocaleString()}
            </div>

            {ev.jobId && ev.status === 'processing' ? (
              <div className="mt-1 text-[10px] text-gray-400 font-mono">
                job: {ev.jobId}
              </div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}
