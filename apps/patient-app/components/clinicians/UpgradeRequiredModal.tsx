'use client';

import React from 'react';
import Link from 'next/link';

type Props = {
  open: boolean;
  reason: string;
  clinician: { id: string; name: string } | null;
  onClose: () => void;
  onUpgrade: () => void;
};

export function UpgradeRequiredModal({
  open,
  reason,
  clinician,
  onClose,
  onUpgrade,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative max-w-md w-full rounded-[28px] border border-white/60 bg-white/86 backdrop-blur-2xl shadow-[0_24px_70px_rgba(15,23,42,0.18)] p-6 z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm">
          Ambulant+ Premium
        </div>

        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
          Premium required
        </h2>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {reason ? (
            <>
              <span className="font-medium text-slate-900">{reason}</span> is a Premium feature.
              Please upgrade to Premium Plan to access it.
            </>
          ) : (
            <>You are currently on a free plan. Please upgrade to Premium Plan to access this function.</>
          )}
        </p>

        {clinician ? (
          <div className="mt-4 text-sm text-slate-600">
            Alternatively, click{' '}
            <Link
              href={`/clinicians/${clinician.id}`}
              className="underline text-teal-700 hover:text-teal-900"
            >
              View
            </Link>{' '}
            to access Clinician Calendar for booking.
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-full border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50"
            type="button"
          >
            Close
          </button>

          <button
            onClick={onUpgrade}
            className="px-3.5 py-1.5 rounded-full bg-slate-950 text-white text-sm hover:bg-slate-800 shadow-sm"
            type="button"
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}