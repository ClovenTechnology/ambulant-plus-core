'use client';

import Link from 'next/link';
import { ConnectionQuality } from 'livekit-client';
import type { ReactNode } from 'react';

import { Badge, IconBtn } from '@/components/ui';
import SessionProgress from './SessionProgress';
import type { RoomParty } from '@/src/lib/rtc/roster-contract';

type Props = {
  roomId: string;
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  quality?: ConnectionQuality;
  qualityLabel: string;
  consentGiven: boolean;
  onConsentChange: (v: boolean) => void;
  consentDisabled?: boolean;
  policyUrl: string;
  dense: boolean;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  presentation: boolean;
  scheduledStartAt?: string | null;
  actualStartAt?: string | null;
  durationMin?: number | null;
  roster?: RoomParty[];
  onToggleDense: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onTogglePresentation: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onBack?: () => void;
  extra?: ReactNode;
};

function qualityTone(q?: ConnectionQuality) {
  if (q === ConnectionQuality.Poor) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (q === ConnectionQuality.Excellent || q === ConnectionQuality.Good) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  return 'border-slate-200 bg-white text-slate-700';
}

function stateTone(
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting',
) {
  switch (state) {
    case 'connected':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'connecting':
    case 'reconnecting':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function stateDot(
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting',
) {
  switch (state) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
    case 'reconnecting':
      return 'bg-amber-500';
    default:
      return 'bg-slate-400';
  }
}

function roleLabel(role: RoomParty['role']) {
  switch (role) {
    case 'lead_patient':
      return 'Patient';
    case 'dependent_patient':
      return 'Dependant';
    case 'observer':
      return 'Observer';
    case 'care_ally':
      return 'Care ally';
    case 'lead_clinician':
      return 'Lead clinician';
    case 'co_clinician':
      return 'Co-clinician';
    case 'advisor':
      return 'Advisor';
    default:
      return role;
  }
}

function rosterTone(party: RoomParty) {
  switch (party.state) {
    case 'joined':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'accepted':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'invited':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'left':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'declined':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function RosterChips({ roster }: { roster?: RoomParty[] }) {
  if (!roster || roster.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {roster.map((party) => (
        <span
          key={party.partyId}
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${rosterTone(
            party,
          )}`}
          title={`${roleLabel(party.role)} · ${party.state}${party.specialty ? ` · ${party.specialty}` : ''}`}
        >
          <span className="truncate max-w-[120px]">
            {party.displayName || roleLabel(party.role)}
          </span>
          <span className="opacity-70">
            {roleLabel(party.role)}
          </span>
          {party.required ? (
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]">
              Required
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export default function PatientSfuHeader(props: Props) {
  const {
    roomId,
    state,
    quality,
    qualityLabel,
    consentGiven,
    onConsentChange,
    consentDisabled = false,
    policyUrl,
    dense,
    leftCollapsed,
    rightCollapsed,
    presentation,
    scheduledStartAt,
    actualStartAt,
    durationMin,
    roster,
    onToggleDense,
    onToggleLeft,
    onToggleRight,
    onTogglePresentation,
    onJoin,
    onLeave,
    extra,
  } = props;

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <header className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 w-full lg:flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900 sm:text-lg md:text-xl">
              Patient Console — Room {roomId}
            </h1>

            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${stateTone(state)}`}>
              <span className={`h-2 w-2 rounded-full ${stateDot(state)}`} />
              {state}
            </span>

            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${qualityTone(quality)}`}>
              Network: {qualityLabel}
            </span>

            {extra}
          </div>

          <RosterChips roster={roster} />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
          <IconBtn
            title={leftCollapsed ? 'Show left pane' : 'Hide left pane'}
            aria-label={leftCollapsed ? 'Show left pane' : 'Hide left pane'}
            onClick={onToggleLeft}
          >
            <span className="text-sm">{leftCollapsed ? '⟫' : '⟪'}</span>
          </IconBtn>

          <button
            onClick={onToggleDense}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {dense ? 'Comfort' : 'Compact'}
          </button>

          <button
            onClick={onTogglePresentation}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {presentation ? 'Exit full screen' : 'Full screen'}
          </button>

          <IconBtn
            title={rightCollapsed ? 'Show right pane' : 'Hide right pane'}
            aria-label={rightCollapsed ? 'Show right pane' : 'Hide right pane'}
            onClick={onToggleRight}
          >
            <span className="text-sm">{rightCollapsed ? '⟪' : '⟫'}</span>
          </IconBtn>

          {state !== 'connected' && state !== 'reconnecting' ? (
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs md:flex">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  disabled={consentDisabled}
                  onChange={(e) => onConsentChange(e.target.checked)}
                />
                <span className="text-slate-700">
                  I consent to this consultation and required camera, microphone, device and vital-sign sharing.
                </span>
              </label>
              <Link
                href={policyUrl}
                target="_blank"
                className="font-medium text-blue-700 underline"
              >
                Policy
              </Link>
            </div>
          ) : (
            <Link
              href={policyUrl}
              target="_blank"
              className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 md:inline-flex"
            >
              Consultation consent recorded · Policy
            </Link>
          )}

          {state !== 'connected' ? (
            <button
              onClick={onJoin}
              disabled={!consentGiven || consentDisabled}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join
            </button>
          ) : (
            <button
              onClick={onLeave}
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 shadow-sm hover:bg-rose-100"
            >
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-4 pb-3">
        <SessionProgress
          scheduledStartAt={scheduledStartAt}
          actualStartAt={actualStartAt}
          durationMin={durationMin}
        />
      </div>
    </div>
  );
}