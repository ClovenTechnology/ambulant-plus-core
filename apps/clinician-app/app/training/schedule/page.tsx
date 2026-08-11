'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  FileBadge2,
  Loader2,
  MapPin,
  PackageCheck,
  PlayCircle,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Video,
} from 'lucide-react';

type TrainingMode = 'virtual' | 'in_person';
type SessionMode = TrainingMode | 'both';
type OnboardingPathwayKey =
  | 'START_NOW_PAY_LATER'
  | 'QUALIFYING_DEPOSIT'
  | 'FULL_PAYMENT';
type StarterKitRelease = 'none' | 'deposit' | 'full';

type PathwayPrivileges = {
  trainingAccess: boolean;
  practiceActivation: boolean;
  starterKitRelease: StarterKitRelease;
  platformIndemnityEligible: boolean;
  balanceRecoveryApplies: boolean;
};

type PathwayPricing = {
  standardPriceCents: number;
  promotionalPriceCents: number | null;
  promotionStartsAt: string | null;
  promotionEndsAt: string | null;
  promotionLabel: string | null;
  promotionActive: boolean;
  effectivePriceCents: number;
  amountDueTodayCents: number;
  savingsCents: number;
};

type CommercialPathway = {
  key: OnboardingPathwayKey;
  displayOrder: number;
  label: string;
  badge: string | null;
  description: string;
  ctaLabel: string;
  enabled: boolean;
  featured: boolean;
  conditions: string[];
  privileges: PathwayPrivileges;
  pricing: PathwayPricing;
};

type TrainingSession = {
  id: string;
  dayNumber: number;
  startAt: string;
  endAt: string;
  mode: SessionMode;
  meetingUrl?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  trainerName?: string | null;
};

type TrainingSlot = {
  id: string;
  title: string;
  summary?: string | null;
  status?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  durationDays: number;
  totalDurationMinutes: number;
  capacity: number;
  usedCount: number;
  seatsLeft: number;
  mode: SessionMode;
  allowedModes: TrainingMode[];
  sessions: TrainingSession[];
  trainerName?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  virtualInstructions?: string | null;
  inPersonInstructions?: string | null;
  bookingOpensAt?: string | null;
  bookingClosesAt?: string | null;
};

type TrainingPolicy = {
  heading: string;
  introduction: string;
  timezone: string;
  defaultDurationDays: number;
  defaultSessionDurationMinutes: number;
  allowedModes: TrainingMode[];
  virtualDescription: string;
  inPersonDescription: string;
  operationalNotice?: string | null;
  supportMessage?: string | null;
};

type OnboardingEntitlements = {
  pathwayKey?: OnboardingPathwayKey | null;
  pathwayLabel?: string | null;
  approvedPayLater?: boolean | null;
  depositQualified?: boolean | null;
  trainingAccess?: boolean | null;
  practiceActivation?: boolean | null;
  starterKitRelease?: StarterKitRelease | null;
  authorisedStarterKitItems?: string[] | null;
  releasedStarterKitItems?: string[] | null;
  missingStarterKitItems?: string[] | null;
  starterKitReleaseSatisfied?: boolean | null;
  platformIndemnityEligible?: boolean | null;
  balanceRecoveryApplies?: boolean | null;
  outstandingCents?: number | null;
  conditions?: string[] | null;
  privileges?: Partial<PathwayPrivileges> | null;
};

type LegalDocument = {
  documentId: string;
  key: string;
  title: string;
  category?: string | null;
  acknowledgementMode: 'REQUIRED' | 'NON_BLOCKING' | 'NOTICE' | string;
  version: {
    id: string;
    versionNumber?: number | null;
    versionLabel?: string | null;
    locale?: string | null;
    contentFormat?: string | null;
    content?: string | null;
    checksum?: string | null;
    effectiveAt?: string | null;
    publishedAt?: string | null;
  };
};

type TrainingContext = {
  ok: boolean;
  clinician?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    specialty?: string | null;
    status?: string | null;
  };
  onboarding?: {
    stage?: string | null;
    notes?: string | null;
    depositPaid?: boolean | null;
    paymentPlan?: string | null;
    paymentStatus?: string | null;
    amountPaidCents?: number | null;
    outstandingCents?: number | null;
    initialRequirementMet?: boolean | null;
    nextPaymentAt?: string | null;
    waiverActive?: boolean | null;
  } | null;
  payLaterRequest?: {
    id: string;
    pathwayKey: 'START_NOW_PAY_LATER';
    status: string;
    requestReason?: string | null;
    requestedAt?: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    active?: boolean | null;
    approved?: boolean | null;
    rejected?: boolean | null;
    canResubmit?: boolean | null;
  } | null;
  training?: (Partial<TrainingSlot> & {
    slotId?: string | null;
    trainingSlotId?: string | null;
    status?: string | null;
    selectedMode?: TrainingMode | null;
    joinUrl?: string | null;
    paid?: boolean | null;
    currency?: string | null;
    feeCents?: number | null;
    certificateNumber?: string | null;
    certificateCompletedAt?: string | null;
    certificateInstitution?: string | null;
    certificateAvailable?: boolean | null;
    certificateUrl?: string | null;
    roomState?: 'not_open' | 'open' | 'closed' | null;
    canJoin?: boolean | null;
    joinOpensAt?: string | null;
    joinClosesAt?: string | null;
  }) | null;
  dispatch?: {
    status?: string | null;
    courierName?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
  entitlements?: OnboardingEntitlements | null;
  pricing?: {
    currency: string;
    trainingFeeCents: number;
    paymentProvider: 'stripe' | 'paystack' | 'payfast' | 'ozow' | 'mock' | 'unknown';
    cardPaymentEnabled?: boolean | null;
    manualPaymentEnabled?: boolean | null;
    minimumInitialPaymentCents?: number | null;
    allowPartialPayment?: boolean | null;
    balanceRecoveryMode?: string | null;
    balanceRecoveryNotes?: string | null;
    commercialPathways?: CommercialPathway[] | null;
    trainingPolicy?: TrainingPolicy | null;
    amountPaidCents?: number | null;
    outstandingCents?: number | null;
    initialPaymentDueCents?: number | null;
    paymentStatus?: string | null;
    initialRequirementMet?: boolean | null;
    fullyPaid?: boolean | null;
    paymentPlan?: string | null;
    waiverActive?: boolean | null;
    effectivePathwayKey?: OnboardingPathwayKey | null;
    privileges?: Partial<PathwayPrivileges> | null;
    configured?: boolean | null;
  };
  bankInstructions?: Record<string, unknown> | null;
  starterKitItems?: string[];
  starterKitDepositItems?: string[];
  error?: unknown;
};

function errorToMessage(
  value: unknown,
  fallback = 'Something went wrong. Please try again or contact Ambulant+ support.',
) {
  if (!value) return fallback;

  if (typeof value === 'string') {
    const message = value.trim();
    if (!message || message === '[object Object]') return fallback;
    const known: Record<string, string> = {
      clinicianId_required:
        'We could not identify your clinician profile. Please sign in again.',
      clinician_not_found:
        'We could not find this clinician application. Please contact Ambulant+ support.',
      pay_later_pathway_disabled:
        'The direct training pathway is currently unavailable. Please choose another published continuation option or contact Ambulant+ support.',
      pay_later_request_storage_unavailable:
        'The direct training pathway is temporarily unavailable. Please try again shortly.',
      pay_later_not_available_after_qualifying_payment:
        'A qualifying C-Med payment has already been recorded for this onboarding account.',
      clinician_identity_mismatch:
        'Your signed-in clinician identity does not match this onboarding record.',
      training_slot_has_ended:
        'That training programme has ended. Choose another available date.',
      training_slot_booking_not_open:
        'Booking for that training programme has not opened yet.',
      training_slot_booking_closed:
        'Booking for that training programme has closed. Choose another date.',
      training_slot_full:
        'That training programme is full. Choose another available date.',
      training_mode_not_available:
        'That training mode is not offered by the selected programme.',
      completed_training_cannot_be_rescheduled:
        'Completed training cannot be moved to another programme.',
    };
    if (known[message]) return known[message];
    if (message.includes('DATABASE_URL') || message.toLowerCase().includes('prisma')) {
      return 'This service is temporarily unable to reach the database. Please try again shortly.';
    }
    return message.length > 220 ? fallback : message.replace(/_/g, ' ');
  }

  if (value instanceof Error) return errorToMessage(value.message, fallback);
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return errorToMessage(
      object.error || object.message || object.reason || object.detail,
      fallback,
    );
  }
  return fallback;
}

function apiError(body: unknown, fallback: string) {
  return errorToMessage(body, fallback);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normaliseCommercialPathways(value: unknown): CommercialPathway[] {
  const allowed = new Set<OnboardingPathwayKey>([
    'START_NOW_PAY_LATER',
    'QUALIFYING_DEPOSIT',
    'FULL_PAYMENT',
  ]);

  if (!Array.isArray(value)) return [];

  return value
    .map((candidate: any): CommercialPathway | null => {
      const key = String(candidate?.key || '').trim().toUpperCase() as OnboardingPathwayKey;
      if (!allowed.has(key)) return null;
      const privileges = candidate?.privileges || {};
      const release = String(privileges.starterKitRelease || '').trim().toLowerCase();
      const rawPricing = candidate?.pricing || {};
      const standardPriceCents = Math.max(
        0,
        Math.round(Number(rawPricing.standardPriceCents ?? candidate?.standardPriceCents ?? 0) || 0),
      );
      const promotionalPriceRaw = rawPricing.promotionalPriceCents ?? candidate?.promotionalPriceCents;
      const promotionalPriceCents =
        promotionalPriceRaw == null || promotionalPriceRaw === ''
          ? null
          : Math.max(0, Math.round(Number(promotionalPriceRaw) || 0));
      const effectivePriceCents = Math.max(
        0,
        Math.round(Number(rawPricing.effectivePriceCents ?? standardPriceCents) || 0),
      );
      const amountDueTodayCents = Math.max(
        0,
        Math.round(Number(rawPricing.amountDueTodayCents ?? candidate?.amountDueTodayCents ?? effectivePriceCents) || 0),
      );

      return {
        key,
        displayOrder: Number.isFinite(Number(candidate?.displayOrder))
          ? Math.max(1, Math.round(Number(candidate.displayOrder)))
          : 99,
        label: String(candidate?.label || key).trim(),
        badge: String(candidate?.badge || '').trim() || null,
        description: String(candidate?.description || '').trim(),
        ctaLabel: String(candidate?.ctaLabel || 'Continue').trim(),
        enabled: candidate?.enabled !== false,
        featured: candidate?.featured === true,
        conditions: stringList(candidate?.conditions).slice(0, 12),
        privileges: {
          trainingAccess: privileges.trainingAccess === true,
          practiceActivation: privileges.practiceActivation === true,
          starterKitRelease:
            release === 'full' || release === 'deposit' ? release : 'none',
          platformIndemnityEligible:
            privileges.platformIndemnityEligible === true,
          balanceRecoveryApplies:
            privileges.balanceRecoveryApplies === true,
        },
        pricing: {
          standardPriceCents,
          promotionalPriceCents,
          promotionStartsAt:
            String(rawPricing.promotionStartsAt ?? candidate?.promotionStartsAt ?? '').trim() || null,
          promotionEndsAt:
            String(rawPricing.promotionEndsAt ?? candidate?.promotionEndsAt ?? '').trim() || null,
          promotionLabel:
            String(rawPricing.promotionLabel ?? candidate?.promotionLabel ?? '').trim() || null,
          promotionActive: rawPricing.promotionActive === true,
          effectivePriceCents,
          amountDueTodayCents,
          savingsCents: Math.max(
            0,
            Math.round(
              Number(
                rawPricing.savingsCents ??
                  Math.max(0, standardPriceCents - effectivePriceCents),
              ) || 0,
            ),
          ),
        },
      };
    })
    .filter((pathway): pathway is CommercialPathway => pathway !== null)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function money(cents: number, currency: string) {
  const amount = Math.max(0, Number(cents || 0)) / 100;
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmt(value?: string | null) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'To be confirmed';
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function fmtDateOnly(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(date);
}

function fmtTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function durationLabel(minutes?: number | null) {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  if (!total) return 'Duration to be confirmed';
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function modeLabel(mode?: SessionMode | null) {
  if (mode === 'in_person') return 'In person';
  if (mode === 'both') return 'Virtual & in person';
  return 'Virtual';
}

function releaseLabel(release?: StarterKitRelease | null) {
  if (release === 'full') return 'Full C-Med package';
  if (release === 'deposit') return 'Deposit C-Med package';
  return 'No C-Med Kit dispatch';
}

function titleCaseKey(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function makeICS({
  title,
  startIso,
  endIso,
  description,
  location,
}: {
  title: string;
  startIso: string;
  endIso: string;
  description?: string;
  location?: string;
}) {
  const toUtc = (iso: string) => {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ambulant+//Training//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:ambulant-training-${Math.random().toString(36).slice(2)}@ambulant.plus`,
    `DTSTAMP:${toUtc(new Date().toISOString())}`,
    `DTSTART:${toUtc(startIso)}`,
    `DTEND:${toUtc(endIso)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\\r\\n');
}

function certificateHref(clinicianId: string) {
  return clinicianId
    ? `/api/training/certificate?clinicianId=${encodeURIComponent(clinicianId)}&download=1`
    : null;
}

function trainingSlotIdForContext(context: TrainingContext | null) {
  return String(
    context?.training?.trainingSlotId ||
      context?.training?.slotId ||
      '',
  );
}

function StepPill({
  active,
  done,
  icon,
  label,
}: {
  active?: boolean;
  done?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const tone = done
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : active
      ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
      : 'border-slate-200 bg-white text-slate-500';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tone}`}>
      {icon}
      <span className="font-semibold">{label}</span>
    </div>
  );
}

function Privilege({ granted, children }: { granted: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
      <CheckCircle2
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${granted ? 'text-emerald-600' : 'text-slate-300'}`}
      />
      <span>{children}</span>
    </div>
  );
}

function CommercialPathwaySelector({
  pathways,
  selectedPathway,
  onSelect,
  amountLabel,
  currency,
}: {
  pathways: CommercialPathway[];
  selectedPathway: OnboardingPathwayKey | null;
  onSelect: (key: OnboardingPathwayKey) => void;
  amountLabel: (key: OnboardingPathwayKey) => string;
  currency: string;
}) {
  if (!pathways.length) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-black text-amber-950">Continuation options are being prepared</h2>
        <p className="mt-1 text-sm text-amber-900">
          Ambulant+ Admin has not enabled a clinician continuation option yet.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="continuation-options-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
            Your next step
          </div>
          <h2 id="continuation-options-heading" className="mt-1 text-xl font-black text-slate-950">
            Choose how you&apos;d like to continue
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            The direct training pathway requires no upfront payment. C-Med Flex and C-Med Full are optional upgrades published by Ambulant+ Admin.
          </p>
        </div>
        <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {selectedPathway ? 'Option selected' : 'Selection required'}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3" role="radiogroup">
        {pathways.map((pathway) => {
          const selected = pathway.key === selectedPathway;
          const direct = pathway.key === 'START_NOW_PAY_LATER';
          const price = pathway.pricing;
          const promotion = !direct && price.promotionActive && price.savingsCents > 0;

          return (
            <button
              key={pathway.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(pathway.key)}
              className={`relative flex h-full flex-col rounded-3xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100 ring-2 ring-indigo-100'
                  : pathway.featured
                    ? 'border-violet-200 bg-gradient-to-b from-violet-50 to-white hover:border-violet-400'
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Option {pathway.displayOrder}
                  </div>
                  <h3 className="mt-1 text-base font-black text-slate-950">{pathway.label}</h3>
                  {pathway.badge ? (
                    <span className="mt-2 inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                      {pathway.badge}
                    </span>
                  ) : null}
                </div>
                <span
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                    selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                  }`}
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
              </div>

              {direct ? (
                <div className="mt-4">
                  <div className="text-2xl font-black tracking-tight text-emerald-700">R0 upfront</div>
                  <div className="mt-1 text-xs font-bold text-emerald-700">No mandatory onboarding payment</div>
                </div>
              ) : (
                <div className="mt-4">
                  {promotion ? (
                    <div className="text-sm font-semibold text-slate-400 line-through">
                      {money(price.standardPriceCents, currency)}
                    </div>
                  ) : null}
                  <div className="text-2xl font-black tracking-tight text-slate-950">
                    {money(price.effectivePriceCents, currency)}
                  </div>
                  {promotion ? (
                    <div className="mt-1 text-xs font-black text-emerald-700">
                      Save {money(price.savingsCents, currency)}
                      {price.promotionEndsAt ? ` · Ends ${fmtDateOnly(price.promotionEndsAt)}` : ''}
                    </div>
                  ) : null}
                  {price.promotionLabel && promotion ? (
                    <div className="mt-1 text-[11px] font-semibold text-violet-700">{price.promotionLabel}</div>
                  ) : null}
                  <div className="mt-2 text-xs font-bold text-slate-600">
                    {pathway.key === 'QUALIFYING_DEPOSIT'
                      ? `${money(price.amountDueTodayCents, currency)} due today`
                      : amountLabel(pathway.key)}
                  </div>
                </div>
              )}

              <p className="mt-3 min-h-16 text-sm leading-relaxed text-slate-600">
                {pathway.description}
              </p>

              <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
                <Privilege granted={pathway.privileges.trainingAccess}>Training access</Privilege>
                <Privilege granted={pathway.privileges.practiceActivation}>Practice activation after required verification, training and approval</Privilege>
                <Privilege granted={pathway.privileges.platformIndemnityEligible}>
                  PI / Medical Malpractice cover eligibility
                </Privilege>
                <Privilege granted={pathway.privileges.starterKitRelease !== 'none'}>
                  {releaseLabel(pathway.privileges.starterKitRelease)}
                </Privilege>
                <Privilege granted={pathway.privileges.balanceRecoveryApplies}>
                  Flexible balance settlement applies
                </Privilege>
              </div>

              {pathway.conditions.length ? (
                <ul className="mt-4 flex-1 space-y-2 text-xs leading-relaxed text-slate-600">
                  {pathway.conditions.map((condition, index) => (
                    <li key={`${pathway.key}-${index}`} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div
                className={`mt-5 rounded-xl px-3 py-2.5 text-center text-xs font-black ${
                  selected ? 'bg-indigo-700 text-white' : 'border bg-slate-50 text-slate-700'
                }`}
              >
                {selected ? 'Selected' : pathway.ctaLabel}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProgrammeCard({
  slot,
  selected,
  onSelect,
}: {
  slot: TrainingSlot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-5 text-left transition ${
        selected
          ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-100'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-slate-950">{slot.title}</h3>
            {selected ? (
              <span className="rounded-full bg-indigo-700 px-2.5 py-1 text-[10px] font-black text-white">
                Selected
              </span>
            ) : null}
          </div>
          {slot.summary ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{slot.summary}</p>
          ) : null}
        </div>
        <div className="shrink-0 rounded-2xl border bg-white px-4 py-3 text-center">
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Seats left</div>
          <div className="mt-1 text-xl font-black text-slate-950">{slot.seatsLeft}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-indigo-600" />{fmt(slot.startAt)}</div>
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-indigo-600" />{slot.durationDays} day{slot.durationDays === 1 ? '' : 's'} · {durationLabel(slot.totalDurationMinutes)}</div>
        <div className="flex items-center gap-2"><Video className="h-4 w-4 text-indigo-600" />{slot.allowedModes.map(modeLabel).join(' or ')}</div>
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600" />{slot.usedCount} of {slot.capacity} booked</div>
      </div>

      {slot.sessions.length ? (
        <div className="mt-4 grid gap-2 border-t border-indigo-100 pt-4 sm:grid-cols-2">
          {slot.sessions.map((session) => (
            <div key={session.id} className="rounded-2xl border bg-white p-3 text-xs text-slate-600">
              <div className="font-black text-slate-900">Day {session.dayNumber}</div>
              <div className="mt-1">{fmt(session.startAt)} – {fmtTime(session.endAt)}</div>
              <div className="mt-1">{modeLabel(session.mode)}{session.trainerName ? ` · ${session.trainerName}` : ''}</div>
            </div>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function LegalNoticePanel({
  documents,
  accepted,
  onToggle,
  status,
}: {
  documents: LegalDocument[];
  accepted: Record<string, boolean>;
  onToggle: (versionId: string, checked: boolean) => void;
  status: 'loading' | 'ready' | 'error';
}) {
  if (status === 'loading') {
    return (
      <section className="rounded-3xl border bg-white p-5 text-sm text-slate-600">
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading published notices…</div>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
        Published onboarding terms could not be loaded. Payment and authorization actions are paused until they are available.
      </section>
    );
  }

  if (!documents.length) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="legal-heading">
      <div className="flex items-start gap-3">
        <BookOpenCheck className="mt-0.5 h-5 w-5 text-indigo-700" />
        <div>
          <h2 id="legal-heading" className="font-black text-slate-950">Published onboarding terms</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            These are the current versions published by Ambulant+ Admin. Required terms must be acknowledged before you continue.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {documents.map((document) => {
          const required = document.acknowledgementMode === 'REQUIRED';
          return (
            <details key={document.version.id} className="group rounded-2xl border bg-slate-50 p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{document.title}</div>
                  <div className="flex gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${required ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {required ? 'Required' : 'Notice'}
                    </span>
                    <span className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {document.version.versionLabel || `Version ${document.version.versionNumber || ''}`}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-indigo-700 group-open:hidden">Open to read</div>
              </summary>

              <div className="mt-4 whitespace-pre-wrap rounded-xl border bg-white p-4 text-sm leading-7 text-slate-700">
                {document.version.content || 'No plain-text content was published for this notice.'}
              </div>

              {required ? (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
                  <input
                    type="checkbox"
                    checked={accepted[document.version.id] === true}
                    onChange={(event) => onToggle(document.version.id, event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-700"
                  />
                  <span>I have read and acknowledge this published version.</span>
                </label>
              ) : null}
            </details>
          );
        })}
      </div>
    </section>
  );
}

function CMedPackageCard({
  release,
  items,
  released,
  missing,
  dispatch,
  preview,
}: {
  release: StarterKitRelease;
  items: string[];
  released: string[];
  missing: string[];
  dispatch?: TrainingContext['dispatch'];
  preview: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-labelledby="cmed-package-heading">
      <div className="border-b bg-gradient-to-r from-slate-950 to-indigo-950 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-2"><PackageCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">
                {preview
                  ? 'Selected continuation option preview'
                  : 'Admin-configured C-Med dispatch'}
              </div>
              <h2 id="cmed-package-heading" className="mt-0.5 text-lg font-black">C-Med package</h2>
            </div>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
            {releaseLabel(release)}
          </span>
        </div>
      </div>

      <div className="p-5">
        {release === 'none' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
            No C-Med Kit is required for this pathway. You can continue to your required training without purchasing a kit.
          </div>
        ) : items.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const shipped = released.includes(item);
              const outstanding = missing.includes(item);
              return (
                <div key={item} className="flex items-start gap-2 rounded-2xl border bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${shipped ? 'text-emerald-600' : 'text-indigo-600'}`} />
                  <div>
                    <div className="font-medium">{item}</div>
                    {shipped ? <div className="mt-0.5 text-[10px] font-bold text-emerald-700">Released</div> : null}
                    {outstanding ? <div className="mt-0.5 text-[10px] font-bold text-amber-700">Awaiting dispatch</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Admin has not published contents for this release level yet.
          </div>
        )}

        {dispatch?.status ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border bg-slate-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-black text-slate-900">Dispatch: <span className="capitalize">{dispatch.status}</span></div>
              <div className="mt-1 text-xs text-slate-600">
                {[dispatch.courierName, dispatch.trackingCode].filter(Boolean).join(' · ') || 'Courier and tracking details will appear here.'}
              </div>
            </div>
            {dispatch.trackingUrl ? (
              <a href={dispatch.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">
                Track shipment <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TrainingSchedulePageContent() {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const [identityReady, setIdentityReady] = useState(false);
  const [clinicianId, setClinicianId] = useState('');
  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [slots, setSlots] = useState<TrainingSlot[]>([]);
  const [mode, setMode] = useState<TrainingMode>('virtual');
  const [slotId, setSlotId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'pay' | 'done'>('pick');
  const [authorisationCode, setAuthorisationCode] = useState('');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popUploading, setPopUploading] = useState(false);
  const [popNotice, setPopNotice] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [selectedCommercialPathway, setSelectedCommercialPathway] =
    useState<OnboardingPathwayKey | null>(null);
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([]);
  const [legalAccepted, setLegalAccepted] = useState<Record<string, boolean>>({});
  const [legalStatus, setLegalStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleSlotId, setRescheduleSlotId] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState<TrainingMode>('virtual');

  useEffect(() => {
    const queryClinicianId = searchParams.get('clinicianId') || '';
    const querySlotId = searchParams.get('slotId') || '';
    if (querySlotId) setSlotId(querySlotId);
    if (queryClinicianId) {
      setClinicianId(queryClinicianId);
      setIdentityReady(true);
      return;
    }

    try {
      const profile = JSON.parse(localStorage.getItem('ambulant.profile') || '{}');
      if (profile?.id) setClinicianId(String(profile.id));
    } catch {
      // Authenticated Gateway identity remains the source of truth.
    }
    setIdentityReady(true);
  }, [searchParams]);

  async function load() {
    if (!identityReady) return;
    setErr(null);
    const clinicianQuery = clinicianId
      ? `?clinicianId=${encodeURIComponent(clinicianId)}`
      : '';
    const legalQuery =
      '?keys=CLINICIAN_ONBOARDING_PAYMENT_DISCLOSURE,CLINICIAN_PROFESSIONAL_INDEMNITY_NOTICE' +
      '&application=clinician-app&surface=clinician-onboarding';

    try {
      const [contextResponse, slotResponse, legalResponse] = await Promise.all([
        fetch(`/api/training/context${clinicianQuery}`, { cache: 'no-store', credentials: 'include' }),
        fetch(`/api/training/slots${clinicianQuery}`, { cache: 'no-store', credentials: 'include' }),
        fetch(`/api/training/legal/published${legalQuery}`, { cache: 'no-store', credentials: 'include' }),
      ]);

      const context = (await contextResponse.json().catch(() => null)) as TrainingContext | null;
      const slotPayload = (await slotResponse.json().catch(() => null)) as
        | { ok: boolean; slots?: TrainingSlot[]; error?: unknown }
        | null;
      const legalPayload = (await legalResponse.json().catch(() => null)) as
        | { ok: boolean; documents?: LegalDocument[]; error?: unknown }
        | null;

      if (!contextResponse.ok || !context?.ok) {
        throw new Error(apiError(context, 'Unable to load your training details right now.'));
      }
      if (!slotResponse.ok || !slotPayload?.ok) {
        throw new Error(apiError(slotPayload, 'Unable to load available training programmes right now.'));
      }

      setCtx(context);
      setSlots(Array.isArray(slotPayload.slots) ? slotPayload.slots : []);

      const resolvedClinicianId = String(context.clinician?.id || '').trim();
      if (resolvedClinicianId && resolvedClinicianId !== clinicianId) {
        setClinicianId(resolvedClinicianId);
      }

      if (legalResponse.ok && legalPayload?.ok) {
        setLegalDocuments(Array.isArray(legalPayload.documents) ? legalPayload.documents : []);
        setLegalStatus('ready');
      } else {
        setLegalDocuments([]);
        setLegalStatus('error');
      }

      const currentPathway =
        context.entitlements?.pathwayKey ||
        context.pricing?.effectivePathwayKey ||
        (context.payLaterRequest || context.onboarding?.waiverActive
          ? 'START_NOW_PAY_LATER'
          : null);
      if (currentPathway) setSelectedCommercialPathway(currentPathway);

      const trainingStatus = String(context.training?.status || '').toLowerCase();
      if (trainingStatus === 'completed' || context.onboarding?.stage === 'training_completed') {
        setStep('done');
      } else if (trainingStatus === 'scheduled' && context.training?.paid) {
        setStep('done');
      } else if (trainingStatus === 'scheduled') {
        setStep('pay');
      } else {
        setStep('pick');
      }

      const returnedSlotId = String(
        context.training?.trainingSlotId || context.training?.slotId || '',
      );
      if (returnedSlotId) setSlotId(returnedSlotId);
      if (context.training?.selectedMode) setMode(context.training.selectedMode);
    } catch (error) {
      setErr(errorToMessage(error, 'Unable to load your onboarding workspace right now.'));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityReady]);

  const pricing = ctx?.pricing;
  const currency = pricing?.currency || 'ZAR';
  const trainingPolicy: TrainingPolicy = pricing?.trainingPolicy || {
    heading: 'Clinician onboarding training',
    introduction: 'Choose a published programme, select an available mode, then choose how you would like to continue. No upfront payment is required for the direct training pathway.',
    timezone: 'Africa/Johannesburg',
    defaultDurationDays: 1,
    defaultSessionDurationMinutes: 60,
    allowedModes: ['virtual', 'in_person'],
    virtualDescription: 'Attend through the secure training room after confirmation.',
    inPersonDescription: 'Attend at the venue published for your programme.',
    operationalNotice: null,
    supportMessage: null,
  };
  const pathways = useMemo(
    () => normaliseCommercialPathways(pricing?.commercialPathways).filter((pathway) => pathway.enabled),
    [pricing?.commercialPathways],
  );
  const selectedPathway = pathways.find((pathway) => pathway.key === selectedCommercialPathway) || null;
  const contextTrainingSlot =
    ctx?.training?.trainingSlotId && ctx.training.startAt && ctx.training.endAt
      ? ({
          ...ctx.training,
          id: String(ctx.training.trainingSlotId),
          title: ctx.training.title || 'Your clinician training programme',
          startAt: ctx.training.startAt,
          endAt: ctx.training.endAt,
          timezone: ctx.training.timezone || trainingPolicy.timezone,
          durationDays: Math.max(1, Number(ctx.training.durationDays || 1)),
          totalDurationMinutes: Math.max(
            1,
            Number(
              ctx.training.totalDurationMinutes ||
                trainingPolicy.defaultSessionDurationMinutes,
            ),
          ),
          capacity: Math.max(0, Number(ctx.training.capacity || 0)),
          usedCount: Math.max(0, Number(ctx.training.usedCount || 0)),
          seatsLeft: Math.max(0, Number(ctx.training.seatsLeft || 0)),
          mode: ctx.training.mode || ctx.training.selectedMode || 'virtual',
          allowedModes:
            ctx.training.allowedModes?.length
              ? ctx.training.allowedModes
              : ctx.training.selectedMode
                ? [ctx.training.selectedMode]
                : trainingPolicy.allowedModes,
          sessions: ctx.training.sessions || [],
        } as TrainingSlot)
      : null;
  const selectedSlot =
    slots.find((slot) => slot.id === slotId) || contextTrainingSlot;
  const eligibleModes = useMemo(() => {
    const policyModes = trainingPolicy.allowedModes || [];
    const programmeModes = selectedSlot?.allowedModes || policyModes;
    return programmeModes.filter((candidate) => policyModes.includes(candidate));
  }, [selectedSlot, trainingPolicy.allowedModes]);

  useEffect(() => {
    if (eligibleModes.length && !eligibleModes.includes(mode)) setMode(eligibleModes[0]);
  }, [eligibleModes, mode]);

  useEffect(() => {
    if (
      selectedCommercialPathway &&
      !pathways.some((pathway) => pathway.key === selectedCommercialPathway)
    ) {
      setSelectedCommercialPathway(null);
    }
  }, [pathways, selectedCommercialPathway]);

  const amountPaid = Math.max(
    0,
    Math.round(Number(pricing?.amountPaidCents ?? ctx?.onboarding?.amountPaidCents ?? 0)),
  );

  function pathwayCharge(key: OnboardingPathwayKey) {
    const pathway = pathways.find((candidate) => candidate.key === key);
    if (!pathway || key === 'START_NOW_PAY_LATER') return 0;
    const requiredNow =
      key === 'QUALIFYING_DEPOSIT'
        ? pathway.pricing.amountDueTodayCents
        : pathway.pricing.effectivePriceCents;
    return Math.max(0, requiredNow - amountPaid);
  }

  function pathwayAmountLabel(key: OnboardingPathwayKey) {
    if (key === 'START_NOW_PAY_LATER') return 'R0 upfront';
    const charge = pathwayCharge(key);
    return charge > 0 ? `${money(charge, currency)} due now` : 'Nothing due now';
  }

  const selectedPathwayIsDirect = selectedCommercialPathway === 'START_NOW_PAY_LATER';

  const trainingStatus = String(ctx?.training?.status || '').toLowerCase();
  const alreadyScheduled = trainingStatus === 'scheduled';
  const alreadyCompleted =
    trainingStatus === 'completed' || ctx?.onboarding?.stage === 'training_completed';
  const alreadyPaid = ctx?.training?.paid === true;
  const alternativeSlots = useMemo(
    () =>
      slots.filter(
        (candidate) =>
          candidate.id !== trainingSlotIdForContext(ctx) &&
          candidate.seatsLeft > 0 &&
          new Date(candidate.endAt).getTime() > Date.now(),
      ),
    [ctx, slots],
  );
  const applicableLegalDocuments = legalDocuments.filter(
    (document) =>
      !selectedPathwayIsDirect ||
      document.key !== 'CLINICIAN_ONBOARDING_PAYMENT_DISCLOSURE',
  );
  const requiredLegalDocuments = applicableLegalDocuments.filter(
    (document) => document.acknowledgementMode === 'REQUIRED',
  );
  const requiredLegalAccepted =
    legalStatus === 'ready' &&
    requiredLegalDocuments.every((document) => legalAccepted[document.version.id] === true);

  async function acknowledgeRequiredLegal(action: string) {
    if (legalStatus !== 'ready') {
      throw new Error('Published onboarding terms are unavailable. Please reload before continuing.');
    }
    const missing = requiredLegalDocuments.filter(
      (document) => legalAccepted[document.version.id] !== true,
    );
    if (missing.length) {
      throw new Error('Please open, read and acknowledge every required published term before continuing.');
    }

    for (const document of requiredLegalDocuments) {
      const response = await fetch('/api/training/legal/acknowledgements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          legalDocumentVersionId: document.version.id,
          documentKey: document.key,
          subjectType: 'clinician',
          subjectId: clinicianId,
          application: 'clinician-app',
          surface: 'clinician-onboarding',
          action: 'ACCEPTED',
          idempotencyKey: [
            'clinician-onboarding',
            document.version.id,
            clinicianId,
            selectedCommercialPathway || 'no-pathway',
            selectedSlot?.id || 'no-slot',
          ].join(':'),
          evidence: {
            action,
            pathwayKey: selectedCommercialPathway,
            trainingSlotId: selectedSlot?.id || null,
            trainingMode: mode,
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(apiError(payload, 'Unable to record your acknowledgement.'));
      }
    }
  }

  async function rescheduleTraining() {
    setErr(null);
    setPaymentNotice(null);

    const nextSlot = alternativeSlots.find(
      (candidate) => candidate.id === rescheduleSlotId,
    );

    if (!nextSlot) {
      setErr('Select an available future training programme.');
      return;
    }

    const nextModes = nextSlot.allowedModes || [];
    if (!nextModes.includes(rescheduleMode)) {
      setErr('Select a training mode offered by the new programme.');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch('/api/training/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clinicianId,
          slotId: nextSlot.id,
          mode: rescheduleMode,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          apiError(payload, 'Unable to change your training date.'),
        );
      }

      await load();
      setRescheduleOpen(false);
      setRescheduleSlotId('');
      setPaymentNotice(
        'Your training date was changed. The previous seat was released.',
      );
    } catch (error) {
      setErr(errorToMessage(error, 'Unable to change your training date.'));
    } finally {
      setBusy(false);
    }
  }

  function validateSelection() {
    if (!selectedSlot) throw new Error('Select a published training programme.');
    if (!eligibleModes.includes(mode)) throw new Error('Select an available training mode.');
    if (!selectedCommercialPathway || !selectedPathway) {
      throw new Error('Choose how you would like to continue.');
    }
  }

  async function proceedToPay() {
    setErr(null);
    try {
      validateSelection();
      setStep('pay');
    } catch (error) {
      setErr(errorToMessage(error));
    }
  }

  async function confirmDirectTraining() {
    setErr(null);
    setPaymentNotice(null);
    try {
      validateSelection();
      if (!selectedPathwayIsDirect) {
        throw new Error('Select Continue to Training for the R0 upfront pathway.');
      }
      setBusy(true);
      await acknowledgeRequiredLegal('DIRECT_TRAINING_CONFIRMATION');
      const response = await fetch('/api/training/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clinicianId,
          slotId: selectedSlot?.id,
          mode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(apiError(payload, 'Unable to confirm your training programme.'));
      }
      await load();
      setStep('done');
      setPaymentNotice('Training programme confirmed. No upfront onboarding payment was required.');
    } catch (error) {
      setErr(errorToMessage(error, 'Unable to confirm your training programme.'));
    } finally {
      setBusy(false);
    }
  }


  async function startCardPayment(pathwayKey: OnboardingPathwayKey | null) {
    setErr(null);
    setPaymentNotice(null);
    try {
      validateSelection();
      if (!pathwayKey || pathwayKey === 'START_NOW_PAY_LATER') {
        throw new Error('Choose Deposit or Full Payment for card checkout.');
      }
      if (!pricing?.configured || !selectedPathway || selectedPathway.pricing.standardPriceCents <= 0) {
        throw new Error('This C-Med option is not priced yet. Please contact Ambulant+ support.');
      }
      if (pricing.cardPaymentEnabled === false) {
        throw new Error('Card payment is currently disabled by Ambulant+ Admin.');
      }

      setBusy(true);
      await acknowledgeRequiredLegal('CARD_PAYMENT_INITIALISATION');
      const callbackUrl = `${window.location.origin}/training/schedule?clinicianId=${encodeURIComponent(
        clinicianId,
      )}&slotId=${encodeURIComponent(selectedSlot?.id || '')}&reason=payment_callback`;
      const response = await fetch('/api/training/payment/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clinicianId,
          slotId: selectedSlot?.id,
          pathwayKey,
          callbackUrl,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(apiError(payload, 'Payment initialisation failed.'));
      }
      if (payload.paymentRequired === false) {
        setPaymentNotice(payload.message || 'No further payment is currently required.');
        await load();
        return;
      }
      if (!payload.redirectUrl) {
        throw new Error('Payment checkout URL was not returned. Please contact Ambulant+ support.');
      }
      window.location.href = payload.redirectUrl;
    } catch (error) {
      setErr(errorToMessage(error, 'Payment initialisation failed.'));
      setBusy(false);
    }
  }

  async function verifyReturnedPayment(reference: string) {
    setErr(null);
    setPaymentNotice('Verifying your payment…');
    setBusy(true);
    try {
      const response = await fetch('/api/training/payment/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clinicianId,
          slotId: slotId || searchParams.get('slotId') || undefined,
          providerReference: reference,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(apiError(payload, 'Payment verification failed.'));
      }
      await load();
      setStep('done');
      setPaymentNotice('Payment confirmed. Your training booking is scheduled.');
    } catch (error) {
      setErr(errorToMessage(error, 'Payment verification failed.'));
      setPaymentNotice(null);
    } finally {
      setBusy(false);
    }
  }

  async function redeemAuthorisationCode() {
    setErr(null);
    setPaymentNotice(null);
    try {
      validateSelection();
      const code = authorisationCode.trim();
      if (!code) throw new Error('Enter the one-time authorization code issued by Admin.');
      setBusy(true);
      await acknowledgeRequiredLegal('AUTHORISATION_CODE_REDEMPTION');
      const response = await fetch('/api/training/payment/authorisation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clinicianId,
          slotId: selectedSlot?.id,
          authorisationCode: code,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(apiError(payload, 'Authorization failed.'));
      }
      await load();
      setStep('done');
      setPaymentNotice('Authorization accepted. Your training booking is scheduled.');
    } catch (error) {
      setErr(errorToMessage(error, 'Authorization failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadProofOfPayment() {
    if (!popFile) {
      setPopNotice('Select a Proof of Payment file first.');
      return;
    }
    if (!clinicianId) {
      setPopNotice('Clinician identity required.');
      return;
    }

    const pathwayKey =
      selectedCommercialPathway;

    if (
      !pathwayKey ||
      pathwayKey ===
        'START_NOW_PAY_LATER'
    ) {
      setPopNotice(
        'Select Deposit or Full Payment before uploading Proof of Payment.',
      );
      return;
    }

    if (
      popFile.size >
      3 * 1024 * 1024
    ) {
      setPopNotice(
        'The Proof of Payment file must not exceed 3 MB.',
      );
      return;
    }

    setPopUploading(true);
    setPopNotice(null);

    try {
      const formData = new FormData();
      formData.append('file', popFile);
      formData.append('clinicianId', clinicianId);
      if (selectedSlot?.id) formData.append('slotId', selectedSlot.id);
      formData.append('pathwayKey', pathwayKey);
      formData.append('trainingMode', mode);

      const res = await fetch('/api/training/payment/pop', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const js = await res.json().catch(() => null);
      if (!res.ok || !js?.ok) {
        throw new Error(
          'proof_of_payment_upload_failed',
        );
      }

      setPopNotice('Proof of Payment uploaded. Admin will review and issue an authorization code.');
      setPopFile(null);
    } catch {
      setPopNotice(
        'We could not complete the Proof of Payment upload. Please try again or contact Ambulant+ support.',
      );
    } finally {
      setPopUploading(false);
    }
  }

  useEffect(() => {
    if (!identityReady || (!clinicianId && !ctx?.clinician?.id)) return;
    const reference =
      searchParams.get('paymentRef') ||
      searchParams.get('reference') ||
      searchParams.get('trxref') ||
      '';
    if (!reference) return;
    const key = `ambulant-training-payment-verified:${reference}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    verifyReturnedPayment(reference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityReady, clinicianId, ctx?.clinician?.id, searchParams]);

  const trainingIcsHref = useMemo(() => {
    const training = ctx?.training;
    if (!training?.startAt || !training?.endAt) return null;
    const title = training.title || 'Ambulant+ Clinician Training';
    const description = [
      `Clinician: ${ctx?.clinician?.name || ctx?.clinician?.email || '-'}`,
      `Mode: ${modeLabel(training.selectedMode || training.mode)}`,
      training.joinUrl ? `Join URL: ${training.joinUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const location =
      training.selectedMode === 'in_person'
        ? [training.venueName, training.venueAddress].filter(Boolean).join(', ')
        : training.joinUrl || 'Virtual';
    return URL.createObjectURL(
      new Blob(
        [
          makeICS({
            title,
            startIso: training.startAt,
            endIso: training.endAt,
            description,
            location,
          }),
        ],
        { type: 'text/calendar;charset=utf-8' },
      ),
    );
  }, [ctx]);

  const resolvedClinicianId = clinicianId || ctx?.clinician?.id || '';
  const certificateDownloadHref = certificateHref(resolvedClinicianId);
  const trainingSlotIdForRoom =
    ctx?.training?.trainingSlotId || ctx?.training?.slotId || slotId || '';
  const trainingRoomHref =
    ctx?.training?.selectedMode === 'virtual' &&
    alreadyScheduled &&
    trainingSlotIdForRoom
      ? `/training/room/${encodeURIComponent(`training-slot-${trainingSlotIdForRoom}`)}?trainingSlotId=${encodeURIComponent(trainingSlotIdForRoom)}`
      : null;
  const trainingRoomCanJoin =
    Boolean(trainingRoomHref) &&
    ctx?.training?.canJoin === true;
  const selectedRescheduleSlot =
    alternativeSlots.find(
      (candidate) => candidate.id === rescheduleSlotId,
    ) || null;
  const rescheduleModes =
    selectedRescheduleSlot?.allowedModes || [];

  const entitlementPathwayKey =
    ctx?.entitlements?.pathwayKey || null;
  const previewingDifferentPathway =
    Boolean(selectedPathway) &&
    selectedPathway?.key !== entitlementPathwayKey;
  const selectedRelease =
    selectedPathway?.privileges.starterKitRelease ||
    'none';
  const effectiveRelease: StarterKitRelease =
    previewingDifferentPathway
      ? selectedRelease
      : ctx?.entitlements?.starterKitRelease ||
        selectedRelease;
  const fullKit = stringList(ctx?.starterKitItems);
  const depositKit = stringList(ctx?.starterKitDepositItems);
  const authorisedKit = stringList(
    ctx?.entitlements?.authorisedStarterKitItems,
  );
  const configuredKit =
    effectiveRelease === 'full'
      ? fullKit
      : effectiveRelease === 'deposit'
        ? depositKit
        : [];
  const packageItems =
    previewingDifferentPathway || !entitlementPathwayKey
      ? configuredKit
      : authorisedKit;
  const releasedKit = previewingDifferentPathway
    ? []
    : stringList(
        ctx?.entitlements?.releasedStarterKitItems,
      );
  const missingKit = previewingDifferentPathway
    ? []
    : stringList(
        ctx?.entitlements?.missingStarterKitItems,
      );
  const packageDispatch = previewingDifferentPathway
    ? undefined
    : ctx?.dispatch;
  const selectedModeInstructions =
    mode === 'in_person'
      ? selectedSlot?.inPersonInstructions
      : selectedSlot?.virtualInstructions;
  const bankEntries = Object.entries(ctx?.bankInstructions || {}).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      ['string', 'number', 'boolean'].includes(typeof value) &&
      String(value).trim(),
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef2ff,_transparent_35%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-xl shadow-indigo-100/40">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 px-6 py-8 text-white sm:px-8 lg:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-indigo-100">
                  <ShieldCheck className="h-4 w-4" /> Secure clinician onboarding
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  {trainingPolicy.heading}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-indigo-100 sm:text-base">
                  {trainingPolicy.introduction}
                </p>
                {ctx?.clinician ? (
                  <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-indigo-200">
                    <span className="font-bold text-white">{ctx.clinician.name || 'Clinician'}</span>
                    {ctx.clinician.email ? <span>{ctx.clinician.email}</span> : null}
                    {ctx.clinician.specialty ? <span>{ctx.clinician.specialty}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                <StepPill icon={<CalendarDays className="h-4 w-4" />} label="1. Programme" active={step === 'pick'} done={step !== 'pick'} />
                <StepPill icon={<CreditCard className="h-4 w-4" />} label="2. Confirm" active={step === 'pay'} done={step === 'done'} />
                <StepPill icon={<BadgeCheck className="h-4 w-4" />} label="3. Ready" active={step === 'done'} done={step === 'done'} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 text-sm text-slate-600 sm:grid-cols-3 sm:px-8 lg:px-10">
            <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-indigo-700" /><span>Patient visibility starts only after Admin certification.</span></div>
            <div className="flex gap-3"><Truck className="h-5 w-5 shrink-0 text-indigo-700" /><span>C-Med StarterKit dispatch follows your effective payment privileges.</span></div>
            <div className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-700" /><span>All schedules and terms are published by Admin.</span></div>
          </div>
        </header>

        {trainingPolicy.operationalNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
            <span className="font-black">Important:</span> {trainingPolicy.operationalNotice}
          </div>
        ) : null}
        {err ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">{err}</div> : null}
        {paymentNotice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{paymentNotice}</div> : null}

        {!ctx ? (
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" />Preparing your secure onboarding workspace…</div>
          </div>
        ) : alreadyCompleted || (alreadyScheduled && alreadyPaid) ? (
          <section className="rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />{alreadyCompleted ? 'Training completed' : 'Training scheduled'}
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">{ctx.training?.title || 'Your clinician training programme'}</h2>
                {ctx.training?.summary ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{ctx.training.summary}</p> : null}
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
                  <span className="rounded-full border bg-slate-50 px-3 py-1.5">{fmt(ctx.training?.startAt)}</span>
                  <span className="rounded-full border bg-slate-50 px-3 py-1.5">{modeLabel(ctx.training?.selectedMode || ctx.training?.mode)}</span>
                  <span className="rounded-full border bg-slate-50 px-3 py-1.5">{ctx.training?.timezone || trainingPolicy.timezone}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {trainingIcsHref && !alreadyCompleted ? <a href={trainingIcsHref} download="ambulant-training.ics" className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50">Add to calendar</a> : null}
                {trainingRoomCanJoin && trainingRoomHref && !alreadyCompleted ? <a href={trainingRoomHref} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800"><PlayCircle className="h-4 w-4" />Open training room</a> : null}
                {trainingRoomHref && !trainingRoomCanJoin && !alreadyCompleted ? (
                  <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-600" aria-disabled="true">
                    <Clock3 className="h-4 w-4" />Room unavailable
                  </span>
                ) : null}
                {!alreadyCompleted ? (
                  <button
                    type="button"
                    onClick={() => {
                      const first = alternativeSlots[0] || null;
                      setRescheduleOpen((open) => !open);
                      if (!rescheduleSlotId && first) {
                        setRescheduleSlotId(first.id);
                        setRescheduleMode(first.allowedModes[0] || 'virtual');
                      }
                    }}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Choose another date
                  </button>
                ) : null}
                {ctx.training?.certificateAvailable && certificateDownloadHref ? <a href={certificateDownloadHref} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Download className="h-4 w-4" />Certificate</a> : null}
              </div>
            </div>

            {!alreadyCompleted && ctx.training?.roomState === 'not_open' ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Your booking is valid. The room opens {fmt(ctx.training.joinOpensAt)}.
              </div>
            ) : null}

            {!alreadyCompleted && ctx.training?.roomState === 'closed' ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                This training room has closed. Choose another available date below; any existing qualifying payment or training entitlement remains in place.
              </div>
            ) : null}

            {rescheduleOpen && !alreadyCompleted ? (
              <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="font-black text-indigo-950">Change training date</div>
                <p className="mt-1 text-xs leading-relaxed text-indigo-900">
                  Confirming a new programme releases your previous seat. Patient invitations are not moved because each patient must consent to the specific session; Admin can invite them to the new slot.
                </p>

                {alternativeSlots.length ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_auto]">
                    <label className="text-xs font-bold text-slate-700">
                      Future programme
                      <select
                        value={rescheduleSlotId}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          const next = alternativeSlots.find((candidate) => candidate.id === nextId);
                          setRescheduleSlotId(nextId);
                          setRescheduleMode(next?.allowedModes[0] || 'virtual');
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {alternativeSlots.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.title} — {fmt(candidate.startAt)} ({candidate.seatsLeft} seats)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-bold text-slate-700">
                      Mode
                      <select
                        value={rescheduleMode}
                        onChange={(event) => setRescheduleMode(event.target.value as TrainingMode)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {rescheduleModes.map((candidate) => (
                          <option key={candidate} value={candidate}>
                            {modeLabel(candidate)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={rescheduleTraining}
                      disabled={busy || !selectedRescheduleSlot}
                      className="self-end rounded-xl bg-indigo-700 px-4 py-2 text-sm font-black text-white hover:bg-indigo-800 disabled:opacity-50"
                    >
                      {busy ? 'Changing…' : 'Confirm new date'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-white p-3 text-sm text-amber-950">
                    No future programme with an available seat is currently published. Contact Ambulant+ Admin for reassignment.
                  </div>
                )}
              </div>
            ) : null}

            {ctx.training?.sessions?.length ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {ctx.training.sessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="font-black text-slate-950">Day {session.dayNumber}</div>
                    <div className="mt-2">{fmt(session.startAt)} – {fmtTime(session.endAt)}</div>
                    <div className="mt-1 text-xs text-slate-600">{modeLabel(session.mode)}{session.trainerName ? ` · ${session.trainerName}` : ''}</div>
                    {session.venueName ? <div className="mt-1 text-xs text-slate-600">{session.venueName}{session.venueAddress ? ` · ${session.venueAddress}` : ''}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {ctx.training?.certificateAvailable ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <div className="flex items-center gap-2 font-black"><FileBadge2 className="h-4 w-4" />Certificate issued</div>
                <div className="mt-2 text-xs">No. {ctx.training.certificateNumber || '-'} · Completed {fmtDateOnly(ctx.training.certificateCompletedAt)} · {ctx.training.certificateInstitution || 'Ambulant+ / Cloven Technology'}</div>
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {step === 'pick' ? (
              <section className="space-y-8 rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Training programme</div>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Choose a published programme</h2>
                  <p className="mt-1 text-sm text-slate-600">Times are shown in {trainingPolicy.timezone} time zone.</p>
                  <div className="mt-5 space-y-4">
                    {!slots.length ? (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                        <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
                        <div className="mt-3 font-black text-slate-900">No programmes are open for booking</div>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{trainingPolicy.supportMessage || 'Ambulant+ Admin is preparing the next training programme. Please check again shortly.'}</p>
                        <button type="button" onClick={load} className="mt-4 rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">Refresh programmes</button>
                      </div>
                    ) : slots.map((slot) => <ProgrammeCard key={slot.id} slot={slot} selected={slot.id === slotId} onSelect={() => setSlotId(slot.id)} />)}
                  </div>
                </div>

                {selectedSlot ? (
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Training mode</div>
                    <h2 className="mt-1 text-xl font-black text-slate-950">How will you attend?</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {eligibleModes.includes('virtual') ? (
                        <button type="button" onClick={() => setMode('virtual')} className={`rounded-3xl border p-5 text-left transition ${mode === 'virtual' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'hover:border-indigo-300'}`}>
                          <Video className="h-5 w-5 text-indigo-700" /><div className="mt-3 font-black text-slate-950">Virtual</div><p className="mt-1 text-sm leading-relaxed text-slate-600">{trainingPolicy.virtualDescription}</p>
                        </button>
                      ) : null}
                      {eligibleModes.includes('in_person') ? (
                        <button type="button" onClick={() => setMode('in_person')} className={`rounded-3xl border p-5 text-left transition ${mode === 'in_person' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'hover:border-indigo-300'}`}>
                          <MapPin className="h-5 w-5 text-indigo-700" /><div className="mt-3 font-black text-slate-950">In person</div><p className="mt-1 text-sm leading-relaxed text-slate-600">{trainingPolicy.inPersonDescription}</p>
                        </button>
                      ) : null}
                    </div>
                    {selectedModeInstructions ? <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">{selectedModeInstructions}</div> : null}
                  </div>
                ) : null}

                <CommercialPathwaySelector pathways={pathways} selectedPathway={selectedCommercialPathway} onSelect={setSelectedCommercialPathway} amountLabel={pathwayAmountLabel} currency={currency} />

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                  <p className="text-xs text-slate-500">Select one programme, an available mode, and how you would like to continue.</p>
                  <button type="button" disabled={busy || !selectedSlot || !selectedPathway || !eligibleModes.includes(mode)} onClick={proceedToPay} className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-black text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
                    Review and confirm
                  </button>
                </div>
              </section>
            ) : (
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <div className="space-y-6 rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Confirmation</div>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">Confirm your training and continuation choice</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">Your training programme and selected continuation option remain subject to the Admin-published terms shown below.</p>
                  </div>

                  {selectedPathwayIsDirect ? (
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
                        <div>
                          <div className="font-black text-emerald-950">Continue to Training — R0 upfront</div>
                          <p className="mt-1 text-sm leading-relaxed text-emerald-900">
                            No financial application or C-Med purchase is required. Confirm the published programme below and continue with your mandatory training.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy || !requiredLegalAccepted}
                        onClick={confirmDirectTraining}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                        Continue to Training
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Amount due now</div>
                            <div className="mt-1 text-3xl font-black text-emerald-950">
                              {selectedCommercialPathway ? pathwayAmountLabel(selectedCommercialPathway) : '-'}
                            </div>
                            {selectedPathway?.pricing.promotionActive && selectedPathway.pricing.savingsCents > 0 ? (
                              <div className="mt-2 text-xs font-black text-emerald-800">
                                Current offer saves {money(selectedPathway.pricing.savingsCents, currency)}
                                {selectedPathway.pricing.promotionEndsAt ? ` · Ends ${fmtDateOnly(selectedPathway.pricing.promotionEndsAt)}` : ''}
                              </div>
                            ) : null}
                          </div>
                          <CreditCard className="h-8 w-8 text-emerald-700" />
                        </div>
                        <button type="button" disabled={busy || !selectedCommercialPathway || pricing?.cardPaymentEnabled === false || pricing?.configured === false || !requiredLegalAccepted} onClick={() => startCardPayment(selectedCommercialPathway)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{selectedPathway?.ctaLabel || 'Continue to secure checkout'}
                        </button>
                      </div>

                      <div className="rounded-3xl border bg-slate-50 p-5">
                        <div className="flex items-center gap-2 font-black text-slate-950"><Banknote className="h-5 w-5 text-indigo-700" />EFT or Admin authorization</div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">After Admin confirms an EFT/manual payment, use the one-time code issued from the Admin onboarding board.</p>
                        {bankEntries.length ? (
                          <dl className="mt-4 grid gap-3 rounded-2xl border bg-white p-4 text-sm sm:grid-cols-2">
                            {bankEntries.map(([key, value]) => <div key={key}><dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{titleCaseKey(key)}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{String(value)}</dd></div>)}
                          </dl>
                        ) : null}

                        {pricing?.manualPaymentEnabled !== false ? (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="text-sm font-black text-amber-950">Upload Proof of Payment</div>
                            <p className="mt-1 text-xs text-amber-800">
                              If you paid by EFT or bank deposit, upload your receipt here. Admin will verify and issue your authorization code.
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                              className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-amber-800"
                            />
                            <button
                              type="button"
                              disabled={popUploading || !popFile || !requiredLegalAccepted}
                              onClick={uploadProofOfPayment}
                              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white hover:bg-amber-800 disabled:opacity-50"
                            >
                              {popUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              {popUploading ? 'Uploading…' : 'Submit PoP'}
                            </button>
                            {popNotice ? <div className="mt-2 text-xs text-amber-900">{popNotice}</div> : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <input id="authorisationCode" value={authorisationCode} onChange={(event) => setAuthorisationCode(event.target.value)} placeholder="AMB-ABC123-DEF456" className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500" />
                          <button type="button" disabled={busy || pricing?.manualPaymentEnabled === false || !requiredLegalAccepted} onClick={redeemAuthorisationCode} className="rounded-xl border bg-white px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-100 disabled:opacity-50">Verify code</button>
                        </div>
                      </div>
                    </>
                  )}

                  <button type="button" disabled={busy} onClick={() => setStep('pick')} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Back to choices</button>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-3xl border bg-white p-5 shadow-sm">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Your selection</div>
                    <h3 className="mt-2 font-black text-slate-950">{selectedSlot?.title || 'No programme selected'}</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-600"><div>{fmt(selectedSlot?.startAt)}</div><div>{modeLabel(mode)}</div><div>{selectedPathway?.label || 'No continuation option selected'}</div></div>
                  </div>
                  {trainingPolicy.supportMessage ? <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5 text-sm leading-relaxed text-indigo-950">{trainingPolicy.supportMessage}</div> : null}
                </aside>
              </section>
            )}
          </>
        )}

        {ctx ? (
          <LegalNoticePanel documents={applicableLegalDocuments} accepted={legalAccepted} onToggle={(versionId, checked) => setLegalAccepted((current) => ({ ...current, [versionId]: checked }))} status={legalStatus} />
        ) : null}

        {ctx ? (
          <CMedPackageCard
            release={effectiveRelease}
            items={packageItems}
            released={releasedKit}
            missing={missingKit}
            dispatch={packageDispatch}
            preview={previewingDifferentPathway}
          />
        ) : null}

        {ctx && !alreadyCompleted ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-white p-5 text-sm text-slate-600">
            <span>
              Need help? Contact Ambulant+ support for onboarding assistance at{' '}
              <a
                href="mailto:support@ambulantplus.co.za"
                className="font-semibold text-indigo-700 hover:underline"
              >
                support@ambulantplus.co.za
              </a>{' '}
              or{' '}
              <a
                href="https://wa.me/27696690899"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-indigo-700 hover:underline"
              >
                WhatsApp +27 69 669 0899
              </a>.
            </span>
            {alreadyPaid && !alreadyCompleted ? (
              <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-950">
                Your clinician workspace unlocks after Ambulant+ Admin certifies your completed training.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function TrainingSchedulePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-7xl p-6">
            <div className="rounded-3xl border bg-white p-8 text-sm text-slate-600">
              <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" />Loading your training workspace…</div>
            </div>
          </div>
        </main>
      }
    >
      <TrainingSchedulePageContent />
    </Suspense>
  );
}
