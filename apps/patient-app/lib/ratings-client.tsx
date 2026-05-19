// apps/patient-app/lib/ratings-client.ts
'use client';

import * as React from 'react';

export type RatingSubjectType =
  | 'clinician'
  | 'pharmacy'
  | 'rider'
  | 'appointment'
  | 'encounter'
  | 'service';

export type SubmitEncounterRatingInput = {
  encounterId: string;
  score: number;
  comment?: string;
  subjectType?: RatingSubjectType;
  subjectName?: string;
};

export type SubmitEncounterRatingResponse = {
  ok: boolean;
  rating?: unknown;
  error?: string;
};

type ClinicianRatingProps = {
  encounterId: string;
  clinicianName: string;
};

function normaliseScore(score: number): number {
  if (!Number.isFinite(score)) return 0;

  return Math.min(5, Math.max(1, score));
}

export async function submitEncounterRating(
  input: SubmitEncounterRatingInput
): Promise<SubmitEncounterRatingResponse> {
  const payload = {
    ...input,
    score: normaliseScore(input.score),
    comment: input.comment?.trim() || undefined,
    subjectType: input.subjectType ?? 'encounter',
  };

  const res = await fetch('/api/ratings/encounter', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as
    | SubmitEncounterRatingResponse
    | null;

  if (!res.ok) {
    return {
      ok: false,
      error:
        data?.error ||
        `Unable to submit rating. Server responded with ${res.status}.`,
    };
  }

  return data ?? { ok: true };
}

export function ClinicianRating({
  encounterId,
  clinicianName,
}: ClinicianRatingProps) {
  const [score, setScore] = React.useState<number>(0);
  const [comment, setComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!score || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitEncounterRating({
        encounterId,
        score,
        comment: comment.trim() || undefined,
        subjectType: 'clinician',
        subjectName: clinicianName,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Unable to submit rating.');
      }

      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to submit rating.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Thank you — your rating has been submitted.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <label htmlFor={`rating-${encounterId}`} className="text-slate-700">
          Rate {clinicianName}
        </label>

        <input
          id={`rating-${encounterId}`}
          type="number"
          min={1}
          max={5}
          step={0.5}
          value={score || ''}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
          aria-label={`Rating for ${clinicianName}`}
        />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
        rows={2}
      />

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !score}
        className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Submit rating'}
      </button>
    </form>
  );
}