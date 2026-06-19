// apps/patient-app/components/clinicians/ClinicianCard.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export type ClinicianCardItem = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  practiceName?: string;
  rating?: number;
  ratingCount?: number;
  online?: boolean;
  status?: string;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  avatarDataUrl?: string | null;
  acceptsMedicalAid?: boolean;
  speaks?: string[];
  yearsExp?: number;
  joinedAt?: number | null;
  operational?: {
    canBeListed?: boolean;
    canBeBooked?: boolean;
    canPrescribe?: boolean;
    prescribingMode?: 'no' | 'conditional' | 'yes';
    allowedWorkspaces?: string[];
    patientCategory?: 'clinical' | 'wellness' | null;
    blockers?: string[];
    riskFlags?: string[];
    ambulantId?: string | null;
  };
};

type ClinicianCardProps = {
  clinician: ClinicianCardItem;
  isPremium: boolean;
  isFav: boolean;
  pinned: boolean;
  encounters: number;
  isNew: boolean;
  isDisabled: boolean;
  isDisciplinary: boolean;
  isPending: boolean;
  availabilityLabel: string | null;
  showTrustBlock: boolean;
  trustLabel: React.ReactNode;
  speaks: string[];
  exp: number | null;
  demoMode: boolean;
  isSyntheticMeta?: boolean;
  priceLabel?: string;
  locationNode: React.ReactNode;
  ratingNode: React.ReactNode;
  favouriteControl: React.ReactNode;
  onToggleCompare: () => void;
  onBook: () => void;
};

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] ?? '')).toUpperCase();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function bookingBlockedReason(clinician: ClinicianCardItem) {
  const blockers = Array.isArray(clinician.operational?.blockers)
    ? clinician.operational?.blockers
    : [];

  if (clinician.operational?.canBeBooked === true) return null;
  if (clinician.operational?.canBeBooked !== false) return null;

  if (blockers.includes('training_incomplete')) return 'Training incomplete';
  if (blockers.includes('training_certificate_missing')) return 'Training certificate missing';
  if (blockers.includes('smart_id_not_issued')) return 'Smart ID not issued';
  if (blockers.includes('smart_id_expired')) return 'Smart ID expired';
  if (blockers.includes('screening_not_approved')) return 'Credentialing not approved';
  if (blockers.includes('listing_disabled')) return 'Temporarily unavailable';
  return 'Booking unavailable';
}

export function ClinicianCard({
  clinician,
  isPremium,
  pinned,
  encounters,
  isNew,
  isDisabled,
  isDisciplinary,
  isPending,
  availabilityLabel,
  showTrustBlock,
  trustLabel,
  speaks,
  exp,
  demoMode,
  isSyntheticMeta,
  priceLabel,
  locationNode,
  ratingNode,
  favouriteControl,
  onToggleCompare,
  onBook,
}: ClinicianCardProps) {
  const bookingReason = bookingBlockedReason(clinician);
  const avatarSrc =
    clinician.avatarUrl ||
    clinician.photoUrl ||
    clinician.avatarDataUrl ||
    '';

  return (
    <div className="group p-4 md:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 transition hover:bg-white/70 hover:backdrop-blur-sm">
      <div className="flex gap-3 items-start min-w-0 flex-1">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-600 via-cyan-500 to-fuchsia-500 text-white grid place-items-center font-semibold shrink-0 shadow-[0_10px_24px_rgba(79,70,229,0.28)]">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`${clinician.name} profile picture`}
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            initialsFromName(clinician.name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            <span className="text-slate-950 truncate text-[15px] md:text-base">
              {clinician.name}
            </span>

            {isPremium && encounters > 0 ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                {encounters} consult{encounters === 1 ? '' : 's'}
              </span>
            ) : null}

            {isNew ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                New
              </span>
            ) : null}

            {availabilityLabel ? (
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-800">
                Next slot: {availabilityLabel}
                {demoMode && isSyntheticMeta ? (
                  <span className="ml-1 text-indigo-500">(demo)</span>
                ) : null}
              </span>
            ) : null}

            {isDisciplinary ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                Under review
              </span>
            ) : null}
          </div>

          <div className="text-sm text-slate-600 mt-0.5">{locationNode}</div>

          {clinician.practiceName ? (
            <div className="text-xs text-slate-500 mt-1 truncate">
              {clinician.practiceName}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
            {isPremium && speaks.length > 0 ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                Speaks: {speaks.join(' · ')}
              </span>
            ) : null}

            {isPremium && exp != null ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                {exp} yrs exp
              </span>
            ) : null}

            {clinician.acceptsMedicalAid === true ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                Accepts Medical Aid / insurance
              </span>
            ) : clinician.acceptsMedicalAid === false ? (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700">
                Private pay
              </span>
            ) : null}

            {isPending && !isNew ? (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700">
                New to Ambulant+
              </span>
            ) : null}

            {isDisabled ? (
              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                {bookingReason || 'Not accepting new bookings'}
              </span>
            ) : null}
          </div>

          <div className="mt-1">{ratingNode}</div>

          {priceLabel ? (
            <div className="text-xs text-slate-700 mt-2">
              From <b className="text-slate-950">{priceLabel}</b> / consult
            </div>
          ) : null}

          {showTrustBlock ? (
            <div className="mt-2 text-[11px] text-slate-600">{trustLabel}</div>
          ) : isPremium && !demoMode ? (
            <div className="mt-2 text-[11px] text-slate-400">
              Trust metrics will appear when live clinician scheduling telemetry is available.
            </div>
          ) : null}

          {bookingReason ? (
            <div className="mt-2 text-[11px] text-red-700">
              Booking status: <span className="font-medium">{bookingReason}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap gap-2.5 items-center shrink-0 lg:pl-4">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full border',
            clinician.online
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-gray-50 border-gray-200 text-gray-700',
          )}
        >
          {clinician.online ? 'Online' : 'Offline'}
        </span>

        <button
          type="button"
          onClick={onToggleCompare}
          className={cn(
            'text-xs px-2.5 py-1.5 rounded-full border transition',
            pinned
              ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
              : 'bg-white/85 hover:bg-white border-slate-200 text-slate-700',
          )}
          aria-pressed={pinned}
        >
          {pinned ? 'Pinned' : 'Pin'}
        </button>

        {favouriteControl}

        <Link
          href={`/clinicians/${clinician.id}`}
          className="text-xs underline text-gray-600 hover:text-slate-900"
        >
          View
        </Link>

        <button
          onClick={onBook}
          className={cn(
            'px-3.5 py-1.5 text-xs rounded-full transition',
            isDisabled || !!bookingReason
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-slate-950 text-white hover:bg-slate-800 shadow-[0_10px_20px_rgba(15,23,42,0.15)]',
          )}
          type="button"
          disabled={isDisabled || !!bookingReason}
          aria-disabled={isDisabled || !!bookingReason}
        >
          {isDisabled ? (bookingReason || 'Not bookable') : 'Book Televisit'}
        </button>
      </div>
    </div>
  );
}
