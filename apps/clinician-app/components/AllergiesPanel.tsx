// apps/clinician-app/components/AllergiesPanel.tsx
'use client';

import React, { useMemo, useState } from 'react';

export type AllergyBrief = {
  id: string;
  substance: string;
  reaction?: string | null;
  severity?: string | null;
  status?: string | null;
  recordedAt?: string | null;
};

export type NewAllergyDraft = {
  substance: string;
  reaction: string;
  severity: '' | 'Mild' | 'Moderate' | 'Severe';
  status: '' | 'Active' | 'Resolved';
};

interface Props {
  allergies: AllergyBrief[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onExport?: () => void;
  onMarkStatus?: (id: string, status: 'Active' | 'Resolved') => void;
  onCreate?: (draft: NewAllergyDraft) => void | Promise<void>;
}

/**
 * Clinician Allergies Panel
 *
 * - Historic allergies: read-only fields, but can Mark Active / Mark Resolved.
 * - Shows severity, status, reaction, recordedAt.
 * - Shows counts: total, active, resolved.
 * - Clinician can add a new allergy (substance, reaction, severity, status).
 * - Refresh / Export buttons match patient-panel semantics.
 */
export default function AllergiesPanel({
  allergies,
  loading = false,
  error,
  onRefresh,
  onExport,
  onMarkStatus,
  onCreate,
}: Props) {
  const [newAllergy, setNewAllergy] = useState<NewAllergyDraft>({
    substance: '',
    reaction: '',
    severity: '',
    status: 'Active',
  });
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const list = allergies || [];
    const total = list.length;
    const active = list.filter(a => (a.status ?? '').toLowerCase() === 'active').length;
    const resolved = list.filter(a => {
      const s = (a.status ?? '').toLowerCase();
      return s.startsWith('resolv') || s === 'inactive';
    }).length;
    return { total, active, resolved };
  }, [allergies]);

  const canAdd =
    !!newAllergy.substance.trim() &&
    !!newAllergy.severity &&
    !busy &&
    !!onCreate;

  const handleAdd = async () => {
    if (!onCreate || !canAdd) return;
    const draft: NewAllergyDraft = {
      substance: newAllergy.substance.trim(),
      reaction: newAllergy.reaction.trim(),
      severity: newAllergy.severity,
      status: newAllergy.status || 'Active',
    };
    setBusy(true);
    try {
      await Promise.resolve(onCreate(draft));
      setNewAllergy({
        substance: '',
        reaction: '',
        severity: '',
        status: 'Active',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header + actions */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">Allergies on File</span>
          <div className="flex flex-wrap gap-1 text-[11px] text-gray-700">
            <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
              Total: {counts.total}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
              Active: {counts.active}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
              Resolved: {counts.resolved}
            </span>
            {error && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                {error}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || !onRefresh}
            className="px-2 py-1 text-xs bg-sky-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!onExport}
            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>

      {/* List */}
      {(!allergies || allergies.length === 0) ? (
        <div className="text-sm text-gray-600 italic">
          No allergies recorded.
        </div>
      ) : (
        <ul className="text-sm space-y-1">
          {allergies.map((a) => {
            const status = (a.status ?? 'Active') as string;
            const sLower = status.toLowerCase();
            const isActive = sLower === 'active';
            const isResolved = sLower.startsWith('resolv') || sLower === 'inactive';

            return (
              <li key={a.id} className="border rounded p-2 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{a.substance}</div>
                  <div className="flex items-center gap-1">
                    {a.severity && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                        {a.severity}
                      </span>
                    )}
                    {a.status && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                        {a.status}
                      </span>
                    )}
                  </div>
                </div>
                {a.reaction && (
                  <div className="text-xs text-gray-700 mt-0.5">
                    Reaction: {a.reaction}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-gray-500">
                    {a.recordedAt && (
                      <>Recorded: {new Date(a.recordedAt).toLocaleDateString()}</>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="px-2 py-0.5 text-[10px] border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                      disabled={!onMarkStatus || isActive}
                      onClick={() => onMarkStatus?.(a.id, 'Active')}
                    >
                      Mark Active
                    </button>
                    <button
                      type="button"
                      className="px-2 py-0.5 text-[10px] border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                      disabled={!onMarkStatus || isResolved}
                      onClick={() => onMarkStatus?.(a.id, 'Resolved')}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add new allergy */}
      <div className="border-t pt-2 mt-1">
        <div className="text-xs text-gray-500 mb-1">
          Add new allergy (historic entries are read-only; status can be toggled).
        </div>
        <div className="grid md:grid-cols-4 gap-2 mb-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Substance (e.g., Penicillin)"
            value={newAllergy.substance}
            onChange={e =>
              setNewAllergy(a => ({ ...a, substance: e.target.value }))
            }
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Reaction (e.g., rash, anaphylaxis)"
            value={newAllergy.reaction}
            onChange={e =>
              setNewAllergy(a => ({ ...a, reaction: e.target.value }))
            }
          />
          <select
            className="border rounded px-2 py-1 text-sm"
            value={newAllergy.severity}
            onChange={e =>
              setNewAllergy(a => ({
                ...a,
                severity: e.target.value as NewAllergyDraft['severity'],
              }))
            }
          >
            <option value="">Severity</option>
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={newAllergy.status}
            onChange={e =>
              setNewAllergy(a => ({
                ...a,
                status: e.target.value as NewAllergyDraft['status'],
              }))
            }
          >
            <option value="Active">Active</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="px-3 py-1.5 text-xs border rounded bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
            disabled={!canAdd}
            onClick={handleAdd}
          >
            {busy ? 'Adding…' : 'Add Allergy'}
          </button>
        </div>
      </div>
    </div>
  );
}
