// apps/patient-app/components/RateEncounterModal.tsx
'use client';

import { useState } from 'react';
import { toast } from '@/components/ToastMount';

type Props = {
  encounterId: string;
  clinicianName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function RateEncounterModal({
  encounterId,
  clinicianName,
  onClose,
  onSubmitted,
}: Props) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!score) {
      setErr('Please choose a rating.');
      return;
    }

    try {
      setSubmitting(true);
      setErr(null);

      const payload = {
        encounterId,
        score,
        comment: comment.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Failed to save rating');
      }

      // ✅ unified toast for clinician + practice rating events
      toast(
        clinicianName
          ? `Thanks for rating your visit with ${clinicianName}.`
          : 'Thanks for rating your visit.',
        'success',
      );

      onSubmitted?.();
      onClose();
    } catch (e: any) {
      const message = e?.message || 'Failed to save rating';
      setErr(message);
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-w-sm w-full rounded-2xl bg-white p-5 shadow-lg">
        <h2 className="text-lg font-semibold">Rate your visit</h2>
        <p className="text-xs text-gray-600 mt-1">
          {clinicianName
            ? `How was your visit with ${clinicianName}?`
            : 'How was your visit?'}
        </p>

        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`text-2xl ${
                n <= score ? 'text-amber-400' : 'text-gray-300'
              } hover:text-amber-500`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className="mt-3 w-full border rounded-md text-sm p-2"
          rows={3}
          placeholder="Anything you’d like to share about this visit? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Submit rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
