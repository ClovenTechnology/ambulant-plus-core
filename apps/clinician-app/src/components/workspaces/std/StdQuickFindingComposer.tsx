// apps/clinician-app/src/components/workspaces/std/StdQuickFindingComposer.tsx
'use client';

import React, { useState } from 'react';
import type { Finding } from '@/src/lib/workspaces/types';
import { FINDING_TYPES, type FindingTypeKey } from './constants';

export default function StdQuickFindingComposer(props: {
  onCreate: (type: FindingTypeKey, severity?: Finding['severity'], note?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { onCreate, disabled } = props;

  const [type, setType] = useState<FindingTypeKey>('risk_assessment');
  const [severity, setSeverity] = useState<NonNullable<Finding['severity']> | ''>('mild');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">New Finding (manual)</div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Type
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as FindingTypeKey)}
            disabled={disabled || saving}
          >
            {FINDING_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Severity
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as '' | NonNullable<Finding['severity']>)}
            disabled={disabled || saving}
          >
            <option value="">—</option>
            <option value="mild">mild</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Note
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional details…"
            disabled={disabled || saving}
          />
        </label>

        <button
          className="mt-1 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onCreate(type, (severity || undefined) as Finding['severity'], note);
              setNote('');
            } finally {
              setSaving(false);
            }
          }}
          type="button"
        >
          {saving ? 'Saving…' : 'Create finding'}
        </button>

        <div className="text-[11px] text-gray-500">
          Tip: use “Bookmark” to attach snapshot + clip evidence to a finding in one step.
        </div>
      </div>
    </div>
  );
}
