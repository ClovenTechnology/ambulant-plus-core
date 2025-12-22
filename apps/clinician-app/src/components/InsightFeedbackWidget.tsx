// apps/clinician-app/src/components/InsightFeedbackWidget.tsx
'use client';

import React, { useMemo, useState } from 'react';

const APIGW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  // fallback if you prefer sharing env names across apps:
  (process.env.NEXT_PUBLIC_APIGW_BASE as string) ||
  'http://localhost:3010';

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

export type InsightModality = 'steth' | 'ecg' | 'ppg' | 'image' | 'other';

export default function InsightFeedbackWidget(props: {
  predictionId: string;
  modality: InsightModality;
  originalLabel?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  encounterId?: string | null;
  compact?: boolean;
}) {
  const {
    predictionId,
    modality,
    originalLabel = null,
    patientId = null,
    clinicianId = null,
    encounterId = null,
    compact = false,
  } = props;

  const [choice, setChoice] = useState<'up' | 'down' | null>(null);
  const [correctedLabel, setCorrectedLabel] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const canSubmit = useMemo(() => {
    if (!choice) return false;
    if (choice === 'up') return true;
    return correctedLabel.trim().length > 0; // require a correction if thumbs-down
  }, [choice, correctedLabel]);

  async function submit() {
    if (!canSubmit || sending) return;
    setSending(true);

    try {
      const body = {
        predictionId,
        modality,
        isCorrect: choice === 'up',
        originalLabel,
        correctedLabel: choice === 'down' ? correctedLabel.trim() : null,
        comment: comment.trim() ? comment.trim() : null,
        patientId,
        clinicianId,
        encounterId,
      };

      const res = await fetch(`${APIGW.replace(/\/+$/, '')}/api/insight/feedback`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'clinician',
          'x-uid': getUid(),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || 'feedback_failed');
      }

      setSent(true);
    } catch (e: any) {
      alert(`Feedback failed: ${e?.message || 'unknown error'}`);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-xs text-green-700 border rounded-lg px-3 py-2 bg-green-50">
        Feedback recorded ✓
      </div>
    );
  }

  return (
    <div className={`border rounded-xl bg-white ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500">Insight feedback</div>
          <div className="text-sm font-medium">
            {originalLabel ? originalLabel : 'Prediction'} <span className="text-xs text-gray-400">• {modality}</span>
          </div>
          <div className="text-[11px] text-gray-400 break-all mt-1">predictionId: {predictionId}</div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChoice(choice === 'up' ? null : 'up')}
            className={`px-3 py-2 text-sm rounded border ${
              choice === 'up' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-gray-50'
            }`}
            aria-label="Thumbs up"
            title="Correct / helpful"
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => setChoice(choice === 'down' ? null : 'down')}
            className={`px-3 py-2 text-sm rounded border ${
              choice === 'down' ? 'bg-rose-600 text-white border-rose-600' : 'hover:bg-gray-50'
            }`}
            aria-label="Thumbs down"
            title="Incorrect / needs correction"
          >
            👎
          </button>
        </div>
      </div>

      {choice === 'down' && (
        <div className="space-y-2">
          <label className="block">
            <div className="text-xs text-gray-500 mb-1">Corrected label (required)</div>
            <input
              value={correctedLabel}
              onChange={(e) => setCorrectedLabel(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g., rhythm: afib / murmur: systolic / otitis: suspected"
            />
          </label>

          <label className="block">
            <div className="text-xs text-gray-500 mb-1">Comment (optional)</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm min-h-[72px]"
              placeholder="Brief clinical reasoning / what you observed…"
            />
          </label>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          This trains/reweights the model via admin reweight workflow.
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || sending}
          className={`px-3 py-2 rounded text-sm ${
            !canSubmit || sending
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {sending ? 'Sending…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
