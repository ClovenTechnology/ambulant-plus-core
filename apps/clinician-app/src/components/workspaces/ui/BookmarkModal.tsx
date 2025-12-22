/*============================================================
FILE 4: apps/clinician-app/src/components/workspaces/ui/BookmarkModal.tsx
============================================================
*/

'use client';

import React, { useEffect, useState } from 'react';

export type BookmarkModalSave = {
  findingTypeKey: string;
  severity?: 'mild' | 'moderate' | 'severe';
  note?: string;
};

export function BookmarkModal({
  open,
  onClose,
  title,
  description,
  findingTypes,
  defaultTypeKey,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  findingTypes: Array<{ key: string; label: string }>;
  defaultTypeKey: string;
  onSave: (payload: BookmarkModalSave) => Promise<void> | void;
}) {
  const [findingTypeKey, setFindingTypeKey] = useState<string>(defaultTypeKey);
  const [severity, setSeverity] = useState<'' | 'mild' | 'moderate' | 'severe'>('');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // keep default in sync if parent changes it
  useEffect(() => {
    setFindingTypeKey(defaultTypeKey);
  }, [defaultTypeKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            {description ? (
              <div className="text-xs text-gray-500">{description}</div>
            ) : null}
          </div>
          <button
            className="text-xs text-gray-600 hover:text-gray-900"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-3">
          {err ? (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {err}
            </div>
          ) : null}

          <label className="text-xs text-gray-600 block">
            Finding type
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={findingTypeKey}
              onChange={(e) => setFindingTypeKey(e.target.value)}
              disabled={saving}
            >
              {findingTypes.map((t) => (
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
              disabled={saving}
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
              disabled={saving}
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={onClose}
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={saving}
              type="button"
              onClick={async () => {
                setErr(null);
                setSaving(true);
                try {
                  await onSave({
                    findingTypeKey,
                    severity: (severity || undefined) as any,
                    note: note?.trim() ? note.trim() : undefined,
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
