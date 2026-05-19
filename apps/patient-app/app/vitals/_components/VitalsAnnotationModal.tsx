'use client';

import React from 'react';
import { formatDateTime } from '../../../src/lib/date';
import { prettyDevice, type Vital } from '../_lib/vitals-ui';

type VitalsAnnotationModalProps = {
  target: Vital | null;
  discreet: boolean;
  annotateText: string;
  setAnnotateText: (value: string) => void;
  annotateError: string | null;
  annotateSaving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function VitalsAnnotationModal(
  props: VitalsAnnotationModalProps,
) {
  const {
    target,
    discreet,
    annotateText,
    setAnnotateText,
    annotateError,
    annotateSaving,
    onClose,
    onSave,
  } = props;

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Add Note(s)</div>
          <button onClick={onClose} className="text-xs text-gray-500" type="button">
            Close
          </button>
        </div>

        <div className="mb-1 text-xs text-gray-500">
          {discreet ? '—' : formatDateTime(target.ts)} · {prettyDevice(target.device)}
        </div>

        <textarea
          className="min-h-[80px] w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder='e.g. "post-exercise", "fasting", "after medication"'
          value={annotateText}
          onChange={(e) => setAnnotateText(e.target.value)}
          disabled={discreet}
        />

        {annotateError && <div className="mt-1 text-[11px] text-red-600">{annotateError}</div>}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border bg-white px-3 py-1 text-[11px] hover:bg-gray-50"
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            disabled={annotateSaving || !annotateText.trim() || discreet}
            className="rounded bg-slate-900 px-3 py-1 text-[11px] text-white disabled:bg-slate-400"
            type="button"
            title={discreet ? 'Notes disabled in Discreet mode' : undefined}
          >
            {annotateSaving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}