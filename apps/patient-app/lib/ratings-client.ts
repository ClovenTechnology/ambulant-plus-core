//apps/patient-app/lib/ratings-client.ts
'use client';

import { useState } from 'react';
import { submitEncounterRating } from '@/lib/ratings-client';

type ClinicianRatingProps = {
  encounterId: string;
  clinicianName: string;
};

export function ClinicianRating({ encounterId, clinicianName }: ClinicianRatingProps) {
  const [score, setScore] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!score) return;

    setSubmitting(true);
    await submitEncounterRating({
      encounterId,
      score,
      comment: comment.trim() || undefined,
      subjectType: 'clinician',
      subjectName: clinicianName,
    });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-sm">
      {/* your star widget / slider etc. */}
      {/* replace with your existing rating control */}
      <div className="flex items-center gap-2">
        <span>Rate {clinicianName}</span>
        <input
          type="number"
          min={1}
          max={5}
          step={0.5}
          value={score || ''}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-20 border rounded px-2 py-1 text-xs"
        />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        className="w-full border rounded px-2 py-1 text-xs"
        rows={2}
      />

      <button
        type="submit"
        disabled={submitting || !score}
        className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Submit rating'}
      </button>
    </form>
  );
}
