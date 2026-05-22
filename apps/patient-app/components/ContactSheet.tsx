// apps/patient-app/components/ContactSheet.tsx
'use client';

import React from 'react';

type RiderProfile = {
  id?: string;
  name?: string;
  avatar?: string;
  rating?: number;
  vehicle?: string;
  phoneMasked?: string;
  phone?: string;
  regPlate?: string;
  tripsCount?: number;
};

interface ContactSheetProps {
  open: boolean;
  onClose: () => void;
  rider: RiderProfile;
}

export default function ContactSheet({ open, onClose, rider }: ContactSheetProps) {
  if (!open) return null;

  const canCall = Boolean(rider.phone);
  const displayName = rider.name || 'Assigned rider pending';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close contact panel"
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
      />

      <section className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Contact</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{displayName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use this panel only for delivery coordination. Clinical questions should remain inside Ambulant+ care channels.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {rider.avatar ? (
            <img src={rider.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
              {(displayName || 'R').slice(0, 1).toUpperCase()}
            </div>
          )}

          <div>
            <div className="font-semibold text-slate-950">{displayName}</div>
            <div className="mt-1 text-sm text-slate-500">{rider.vehicle || 'Vehicle details pending'}</div>
            {rider.regPlate ? <div className="mt-1 text-xs text-slate-500">Plate {rider.regPlate}</div> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <a
            href={canCall ? `tel:${rider.phone}` : undefined}
            aria-disabled={!canCall}
            className={
              canCall
                ? 'rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800'
                : 'pointer-events-none rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-400'
            }
          >
            {canCall ? `Call ${rider.phoneMasked || 'rider'}` : 'Phone unavailable'}
          </a>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Completed CarePort trips: <span className="font-semibold text-slate-900">{rider.tripsCount ?? '—'}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
