// apps/clinician-app/app/dental-workspace/_components/TreatmentPlan.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { PlanItem } from '../_lib/types';

export default function TreatmentPlan({
  selectedToothUniversal,
  selectedToothDisplay,
  items,
  onAdd,
  onToggle,
  busy,
}: {
  selectedToothUniversal: string;
  selectedToothDisplay: string;
  items: PlanItem[];
  onAdd: (label: string, toothIdUniversal?: string) => void;
  onToggle: (id: string) => void;
  busy?: boolean;
}) {
  const [label, setLabel] = useState('');
  const [linkToTooth, setLinkToTooth] = useState(true);

  const filtered = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const at = a.toothId ? 0 : 1;
      const bt = b.toothId ? 0 : 1;
      if (at !== bt) return at - bt;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    return list;
  }, [items]);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">Treatment plan</div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Planned item
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Composite filling, extraction, crown prep…"
            disabled={busy}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={linkToTooth}
            onChange={() => setLinkToTooth((v) => !v)}
            disabled={busy}
          />
          Link to selected tooth ({selectedToothDisplay})
        </label>

        <button
          type="button"
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={busy || !label.trim()}
          onClick={() => {
            onAdd(label, linkToTooth ? selectedToothUniversal : undefined);
            setLabel('');
          }}
        >
          + Add plan item
        </button>
      </div>

      <div className="mt-3">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-600 italic">No plan items yet.</div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => (
              <li key={p.id} className="rounded-lg border p-2 bg-white flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {p.label}
                    {p.toothId ? <span className="ml-2 text-[11px] text-gray-500">tooth {p.toothId}</span> : null}
                  </div>
                  <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  className={
                    'text-[11px] rounded-full border px-2 py-0.5 ' +
                    (p.status === 'done'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-gray-50 text-gray-700')
                  }
                  onClick={() => onToggle(p.id)}
                  disabled={busy}
                >
                  {p.status === 'done' ? 'Done' : 'Planned'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
