'use client';

import React from 'react';
import type { Finding } from '@/src/lib/workspaces/types';

export function FindingCard({
  finding,
  evidenceCount,
  onToggleFinal,
}: {
  finding: Finding;
  evidenceCount?: number;
  onToggleFinal?: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{finding.title}</div>
          <div className="text-xs text-gray-500">
            {finding.status.toUpperCase()} · {finding.severity ?? '—'} ·{' '}
            {new Date(finding.createdAt).toLocaleString()}
          </div>
        </div>

        {onToggleFinal ? (
          <button
            type="button"
            className={
              'text-[11px] rounded-full border px-2 py-0.5 ' +
              (finding.status === 'final'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-gray-200 bg-gray-50 text-gray-700')
            }
            onClick={() => onToggleFinal(finding.id)}
            title="Toggle draft/final"
          >
            {finding.status === 'final' ? 'Final' : 'Draft'}
          </button>
        ) : null}
      </div>

      {finding.note ? (
        <div className="mt-2 text-sm text-gray-700">{finding.note}</div>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Updated: {new Date(finding.updatedAt).toLocaleTimeString()}
        </div>
        {typeof evidenceCount === 'number' ? (
          <span className="text-[11px] rounded-full border px-2 py-0.5 bg-gray-50 text-gray-700">
            {evidenceCount} evidence
          </span>
        ) : null}
      </div>
    </div>
  );
}
