'use client';

import React, { useMemo } from 'react';
import type { ApiReminder } from './shared';

type Props = {
  reminders: ApiReminder[];
  onPrimaryAction: (rem: ApiReminder) => void;
  onTakenEarlier: (rem: ApiReminder) => void;
  onSnooze: (rem: ApiReminder, mins?: number) => void;
  nextDueId?: string | null;
};

type BucketKey = 'morning' | 'afternoon' | 'evening' | 'night';

const BUCKET_ORDER: BucketKey[] = ['morning', 'afternoon', 'evening', 'night'];

const BUCKET_META: Record<BucketKey, { label: string; tone: string }> = {
  morning: { label: 'Morning', tone: 'border-amber-200 bg-amber-50/70' },
  afternoon: { label: 'Afternoon', tone: 'border-sky-200 bg-sky-50/70' },
  evening: { label: 'Evening', tone: 'border-indigo-200 bg-indigo-50/70' },
  night: { label: 'Night', tone: 'border-violet-200 bg-violet-50/70' },
};

function parseMinutes(hhmm?: string | null) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh * 60 + mm;
}

function toBucket(time?: string | null): BucketKey {
  const mins = parseMinutes(time);
  if (mins == null) return 'morning';
  if (mins < 12 * 60) return 'morning';
  if (mins < 17 * 60) return 'afternoon';
  if (mins < 21 * 60) return 'evening';
  return 'night';
}

function timeCountdown(time?: string | null) {
  const mins = parseMinutes(time);
  if (mins == null) return null;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const diff = mins - nowMins;

  if (diff <= 0) return null;
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function evidenceBadge(rem: ApiReminder) {
  if (rem.status !== 'Taken') return null;
  if (rem.verificationStatus === 'VERIFIED' || rem.takenSource === 'CAMERA_VERIFIED') {
    return <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-800">Verified</span>;
  }
  if (rem.verificationStatus === 'SELF_REPORTED' || rem.takenSource === 'SELF_REPORTED') {
    return <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">Self reported</span>;
  }
  return null;
}

export default function DigitalPillOrganizer({
  reminders,
  onPrimaryAction,
  onTakenEarlier,
  onSnooze,
  nextDueId,
}: Props) {
  const grouped = useMemo(() => {
    const seed: Record<BucketKey, ApiReminder[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    reminders.forEach((rem) => {
      seed[toBucket(rem.time)].push(rem);
    });

    BUCKET_ORDER.forEach((k) => {
      seed[k] = seed[k].slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    });

    return seed;
  }, [reminders]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-950">Digital pill organizer</div>
          <div className="text-xs text-slate-500">
            Morning, afternoon, evening, and night dose tiles with next-due visibility.
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {BUCKET_ORDER.map((bucket) => (
          <div
            key={bucket}
            className={`rounded-3xl border p-4 shadow-sm ${BUCKET_META[bucket].tone}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-black text-slate-900">{BUCKET_META[bucket].label}</div>
              <div className="text-[11px] font-semibold text-slate-500">
                {grouped[bucket].length} item{grouped[bucket].length === 1 ? '' : 's'}
              </div>
            </div>

            {grouped[bucket].length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-xs text-slate-500">
                No doses in this window.
              </div>
            ) : (
              <div className="space-y-2">
                {grouped[bucket].map((rem) => {
                  const isNext = nextDueId === rem.id;
                  const countdown = timeCountdown(rem.time);
                  const verificationRequired = Boolean(rem.verificationRequired ?? rem.meta?.verificationRequired);

                  return (
                    <div
                      key={rem.id}
                      className={`rounded-2xl border bg-white p-3 shadow-sm ${
                        isNext ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">{rem.name}</div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {rem.dose ? `${rem.dose} · ` : ''}
                            {rem.time ?? 'No time'}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                              rem.status === 'Pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : rem.status === 'Taken'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rem.status}
                          </span>

                          {evidenceBadge(rem)}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                        {verificationRequired ? (
                          <span className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-800">
                            Camera verification
                          </span>
                        ) : null}

                        {rem.source ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                            {String(rem.source).toUpperCase()}
                          </span>
                        ) : null}

                        {isNext && countdown ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                            Next due in {countdown}
                          </span>
                        ) : null}
                      </div>

                      {rem.status === 'Pending' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onPrimaryAction(rem)}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
                          >
                            {verificationRequired ? 'Verify dose' : 'Confirm'}
                          </button>

                          {verificationRequired ? (
                            <button
                              type="button"
                              onClick={() => onTakenEarlier(rem)}
                              className="rounded-xl bg-amber-100 px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-200"
                            >
                              Taken earlier
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => onSnooze(rem, 15)}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-800 hover:bg-slate-200"
                          >
                            Snooze
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}