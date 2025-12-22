// apps/clinician-app/app/dental-workspace/_components/ToothChart.tsx
'use client';

import React, { useMemo } from 'react';
import type { ToothSystem } from '../_lib/types';
import { toDisplayToothId } from '../_lib/toothMap';

export default function ToothChart({
  toothSystem,
  selectedUniversal,
  onSelectUniversal,
  counts,
}: {
  toothSystem: ToothSystem;
  selectedUniversal: string;
  onSelectUniversal: (toothIdUniversal: string) => void;
  counts: Map<string, number>;
}) {
  const upper = useMemo(() => Array.from({ length: 16 }, (_, i) => String(i + 1)), []);
  const lower = useMemo(() => Array.from({ length: 16 }, (_, i) => String(32 - i)), []);

  const ToothBtn = ({ idUniversal }: { idUniversal: string }) => {
    const isSel = idUniversal === selectedUniversal;
    const c = counts.get(idUniversal) ?? 0;
    const label = toDisplayToothId(idUniversal, toothSystem);

    return (
      <button
        key={idUniversal}
        type="button"
        onClick={() => onSelectUniversal(idUniversal)}
        className={
          'relative rounded-lg border px-2 py-2 text-sm font-medium ' +
          (isSel
            ? 'border-blue-300 bg-blue-50 text-blue-800'
            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800')
        }
        aria-pressed={isSel}
        title={`Tooth ${label} (${idUniversal} universal)`}
      >
        {label}
        {c > 0 ? (
          <span className="absolute -top-1 -right-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5">
            {c}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] text-gray-500 mb-2">Upper</div>
        <div className="grid grid-cols-8 gap-2">
          {upper.map((id) => (
            <ToothBtn key={id} idUniversal={id} />
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-gray-500 mb-2">Lower</div>
        <div className="grid grid-cols-8 gap-2">
          {lower.map((id) => (
            <ToothBtn key={id} idUniversal={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
