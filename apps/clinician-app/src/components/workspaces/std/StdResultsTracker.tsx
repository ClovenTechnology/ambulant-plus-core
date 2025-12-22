// apps/clinician-app/src/components/workspaces/std/StdResultsTracker.tsx
'use client';

import React, { useMemo, useState } from 'react';

export type StdResultStatus =
  | 'planned'
  | 'ordered'
  | 'collected'
  | 'resulted'
  | 'reviewed'
  | 'communicated';

export type StdResult = {
  id: string;

  // If seeded, we keep the screening key for idempotent re-seeding
  testKey?: string;

  testLabel: string;
  specimenSites: string[]; // e.g. ["blood", "urine"]

  status: StdResultStatus;

  orderedDate?: string; // YYYY-MM-DD
  collectedDate?: string; // YYYY-MM-DD
  resultedDate?: string; // YYYY-MM-DD

  abnormal?: boolean;

  // Minimal clinically neutral text fields
  resultText?: string;
  interpretation?: string;
  notes?: string;
};

const STATUS_OPTIONS: { key: StdResultStatus; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'collected', label: 'Collected' },
  { key: 'resulted', label: 'Resulted' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'communicated', label: 'Communicated' },
];

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function StdResultsTracker(props: {
  results: StdResult[];
  busy?: boolean;
  sensitiveMaskClass?: string;

  // for seeding + context hints
  screening: Record<string, boolean>;
  specimenSites: Record<string, boolean>;

  actions: {
    seedFromScreening: () => void;

    addCustomResult: (label: string) => void;
    updateResult: (id: string, patch: Partial<StdResult>) => void;
    removeResult: (id: string) => void;

    exportOrdersAsFinding: () => Promise<void>;
    exportResultsAsFinding: () => Promise<void>;
  };
}) {
  const { results, busy, sensitiveMaskClass, screening, specimenSites, actions } = props;

  const [customLabel, setCustomLabel] = useState('');

  const selectedSites = useMemo(() => {
    return Object.entries(specimenSites)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }, [specimenSites]);

  const screeningSelected = useMemo(() => Object.values(screening).some(Boolean), [screening]);

  return (
    <div className={'rounded-lg border bg-white p-3 ' + (sensitiveMaskClass || '')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-700">Results tracker (Phase 1 MVP)</div>
          <div className="text-[11px] text-gray-500">
            Local-only timeline. Export creates clean Findings notes (no new endpoints needed).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={actions.seedFromScreening}
            disabled={busy || !screeningSelected}
            type="button"
            title={!screeningSelected ? 'Select screening items first' : 'Creates tracker rows for selected screening items'}
          >
            Seed from screening
          </button>
        </div>
      </div>

      {selectedSites.length ? (
        <div className="mt-2 text-[11px] text-gray-600">
          Current specimen sites selected: <span className="font-semibold">{selectedSites.map(titleCase).join(', ')}</span>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-gray-500">
          Tip: choose specimen sites in Screening to make tracker entries more complete.
        </div>
      )}

      {/* Add custom */}
      <div className="mt-3 flex items-center gap-2">
        <input
          className="w-full rounded border px-2 py-1.5 text-sm"
          placeholder="Add custom test (e.g., Trichomonas NAAT, HSV PCR, etc.)"
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          disabled={busy}
        />
        <button
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={busy || !customLabel.trim()}
          onClick={() => {
            const v = customLabel.trim();
            if (!v) return;
            actions.addCustomResult(v);
            setCustomLabel('');
          }}
          type="button"
        >
          Add
        </button>
      </div>

      {/* Results list */}
      <div className="mt-3 space-y-2">
        {results.length === 0 ? (
          <div className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
            No results tracked yet. Use <span className="font-semibold">Seed from screening</span> or add a custom test.
          </div>
        ) : (
          results.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{r.testLabel}</div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Sites: {r.specimenSites?.length ? r.specimenSites.map(titleCase).join(', ') : 'Not specified'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!r.abnormal}
                      onChange={(e) => actions.updateResult(r.id, { abnormal: e.target.checked })}
                      disabled={busy}
                    />
                    Abnormal
                  </label>

                  <button
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => actions.removeResult(r.id)}
                    disabled={busy}
                    type="button"
                    title="Remove tracker row"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="text-xs text-gray-600">
                  Status
                  <select
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={r.status}
                    onChange={(e) => actions.updateResult(r.id, { status: e.target.value as StdResultStatus })}
                    disabled={busy}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-gray-600">
                  Ordered date
                  <input
                    type="date"
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={r.orderedDate || ''}
                    onChange={(e) => actions.updateResult(r.id, { orderedDate: e.target.value || undefined })}
                    disabled={busy}
                  />
                </label>

                <label className="text-xs text-gray-600">
                  Collected date
                  <input
                    type="date"
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={r.collectedDate || ''}
                    onChange={(e) => actions.updateResult(r.id, { collectedDate: e.target.value || undefined })}
                    disabled={busy}
                  />
                </label>

                <label className="text-xs text-gray-600 md:col-span-3">
                  Result date
                  <input
                    type="date"
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={r.resultedDate || ''}
                    onChange={(e) => actions.updateResult(r.id, { resultedDate: e.target.value || undefined })}
                    disabled={busy}
                  />
                </label>

                <label className="text-xs text-gray-600 md:col-span-3">
                  Result (free text)
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    rows={2}
                    value={r.resultText || ''}
                    onChange={(e) => actions.updateResult(r.id, { resultText: e.target.value || undefined })}
                    disabled={busy}
                    placeholder="e.g., Negative / Non-reactive / Detected / Value…"
                  />
                </label>

                <label className="text-xs text-gray-600 md:col-span-3">
                  Interpretation (optional)
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    rows={2}
                    value={r.interpretation || ''}
                    onChange={(e) => actions.updateResult(r.id, { interpretation: e.target.value || undefined })}
                    disabled={busy}
                    placeholder="Clinician interpretation / action triggers…"
                  />
                </label>

                <label className="text-xs text-gray-600 md:col-span-3">
                  Notes (optional)
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    rows={2}
                    value={r.notes || ''}
                    onChange={(e) => actions.updateResult(r.id, { notes: e.target.value || undefined })}
                    disabled={busy}
                    placeholder="Communication, follow-up, lab notes…"
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export buttons */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <button
          className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={actions.exportOrdersAsFinding}
          disabled={busy || results.length === 0}
          type="button"
          title="Creates a Tests ordered finding summarizing the tracker"
        >
          Export orders → Finding
        </button>

        <button
          className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={actions.exportResultsAsFinding}
          disabled={busy || results.length === 0}
          type="button"
          title="Creates a Results review finding summarizing the tracker"
        >
          Export results → Finding
        </button>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Phase 2: server-backed results, attachments, lab integrations, patient-visible communication events + audit trail.
      </div>
    </div>
  );
}
