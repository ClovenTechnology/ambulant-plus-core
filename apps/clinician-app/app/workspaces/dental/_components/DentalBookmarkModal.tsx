// apps/clinician-app/app/workspaces/dental/_components/DentalBookmarkModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import type { ToothSurface, FindingTypeKey } from '../_lib/types';
import { FINDING_TYPES } from '../_lib/types';

export default function DentalBookmarkModal({
  open,
  onClose,
  selectedToothUniversal,
  selectedToothDisplay,
  selectedSurface,
  onSave,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  selectedToothUniversal: string;
  selectedToothDisplay: string;
  selectedSurface?: ToothSurface;
  busy?: boolean;
  onSave: (payload: {
    toothId: string; // universal
    surface?: ToothSurface;
    findingTypeKey: FindingTypeKey;
    severity?: 'mild' | 'moderate' | 'severe';
    note?: string;
    alsoAddPin?: boolean;
  }) => Promise<void>;
}) {
  const [toothId, setToothId] = useState(selectedToothUniversal);
  const [surface, setSurface] = useState<ToothSurface | ''>(selectedSurface ?? '');
  const [findingTypeKey, setFindingTypeKey] = useState<FindingTypeKey>('caries_suspected');
  const [severity, setSeverity] = useState<'' | 'mild' | 'moderate' | 'severe'>('moderate');
  const [note, setNote] = useState('');
  const [alsoAddPin, setAlsoAddPin] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setToothId(selectedToothUniversal);
    setSurface(selectedSurface ?? '');
  }, [selectedToothUniversal, selectedSurface]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white border shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Bookmark to tooth</div>
            <div className="text-xs text-gray-500">
              Creates finding + live_capture evidence (jobs) · Selected: <span className="font-mono">{selectedToothDisplay}</span>
            </div>
          </div>
          <button type="button" className="text-xs text-gray-600 hover:text-gray-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="p-4 space-y-3">
          {err ? (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600 block">
              Tooth # (universal storage)
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={toothId}
                onChange={(e) => setToothId(e.target.value)}
                placeholder="e.g. 14"
                disabled={saving || busy}
              />
            </label>

            <label className="text-xs text-gray-600 block">
              Surface
              <select
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={surface}
                onChange={(e) => setSurface(e.target.value as any)}
                disabled={saving || busy}
              >
                <option value="">—</option>
                {(['O', 'M', 'D', 'B', 'L'] as ToothSurface[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs text-gray-600 block">
            Finding type
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={findingTypeKey}
              onChange={(e) => setFindingTypeKey(e.target.value as any)}
              disabled={saving || busy}
            >
              {FINDING_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-600 block">
            Severity
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              disabled={saving || busy}
            >
              <option value="">—</option>
              <option value="mild">mild</option>
              <option value="moderate">moderate</option>
              <option value="severe">severe</option>
            </select>
          </label>

          <label className="text-xs text-gray-600 block">
            Note
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional details…"
              disabled={saving || busy}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={alsoAddPin} onChange={() => setAlsoAddPin((v) => !v)} disabled={saving || busy} />
            Auto-add a pin annotation (wow)
          </label>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50" onClick={onClose} disabled={saving || busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={saving || busy || !String(toothId || '').trim()}
              onClick={async () => {
                setErr(null);
                setSaving(true);
                try {
                  await onSave({
                    toothId: String(toothId).trim(),
                    surface: (surface || undefined) as any,
                    findingTypeKey,
                    severity: (severity || undefined) as any,
                    note: note?.trim() ? note.trim() : undefined,
                    alsoAddPin,
                  });
                  setNote('');
                  onClose();
                } catch (e: any) {
                  setErr(e?.message || 'Failed to save bookmark');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
