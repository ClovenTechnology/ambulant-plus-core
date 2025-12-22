// apps/patient-app/app/clinicians/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';
import cleanText from '@/lib/cleanText';

import { COUNTRY_LABELS, COUNTRY_OPTIONS, getMockCliniciansForCountry, type CountryCode } from '@/mock/clinicians-by-country';

const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
type UIClass = (typeof UI_CLASSES)[number];

const PAGE_SIZE = 10;
const FAV_KEY = 'clinician.favs';
const ENCOUNTER_KEY = 'clinician.encounters.v1';
const COMPARE_KEY = 'clinician.compare.v1';

// fairness tuning constants
const BOOKING_PENALTY_WINDOW_MS = 1000 * 60 * 60 * 2;
const BOOKING_DECAY_MS = BOOKING_PENALTY_WINDOW_MS;
const BOOKED_COUNT_PENALTY_WEIGHT = 60 * 60 * 1000;

// “new clinician” window
const NEW_CLINICIAN_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

type ClinicianItem = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  cls?: 'Doctor' | 'Allied Health' | 'Wellness';
  gender?: string;

  // price (either API ZAR or mock global)
  priceZAR?: number;
  priceCents?: number;
  currency?: string;

  rating?: number;
  ratingCount?: number;
  online?: boolean;
  status?: 'active' | 'pending' | 'disabled' | 'disciplinary' | string;

  // fields required for fairness
  lastBookedAt?: number | null;
  lastSeenAt?: number | null;
  onlineSeq?: number | null;
  recentBookedCount?: number;

  // practice & medical aid info for patients
  acceptsMedicalAid?: boolean;
  acceptedSchemes?: string[];
  practiceName?: string;

  // global fields
  country?: CountryCode;
  speaks?: string[];
  yearsExp?: number;

  // onboarding / platform tenure
  joinedAt?: number | null; // ms epoch

  // optional (future backend wiring)
  nextAvailableAt?: number | null; // ms epoch
  consultMins?: number | null; // avg consult length
  followupMins?: number | null; // follow-up length
  responseTimeMins?: number | null; // typical response time
};

/* ---------------------------
   Helpers
--------------------------- */
function toDataClass(tab: UIClass): 'Doctor' | 'Allied Health' | 'Wellness' {
  return tab === 'Doctors' ? 'Doctor' : tab;
}
function normalizeClassParam(v: string | null): UIClass | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === 'doctor' || s === 'doctors') return 'Doctors';
  if (s === 'allied health') return 'Allied Health';
  if (s === 'wellness') return 'Wellness';
  return null;
}

const HOVER_MENUS: Record<UIClass, string[]> = {
  Doctors: ['GPs', 'Dentists', 'Specialists'],
  'Allied Health': ['Nurses', 'Pharmacists', 'Therapists'],
  Wellness: ['Chiropractor', 'Dieticians', 'Lifestyle'],
};

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] ?? '')).toUpperCase();
}

function formatMoney(currency?: string, cents?: number, fallbackZar?: number) {
  if (typeof cents === 'number' && currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  }
  if (typeof fallbackZar === 'number') return `R${Number(fallbackZar).toFixed(0)}`;
  return '';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ No imports needed for flags.
 * Converts ISO 3166-1 alpha-2 country codes into Unicode flag emoji.
 */
function flagEmojiFromCountryCode(code: string) {
  const cc = (code || '').toUpperCase();
  if (cc.length !== 2) return '🌍';
  const A = 0x1f1e6;
  const base = 'A'.charCodeAt(0);
  const c1 = cc.charCodeAt(0);
  const c2 = cc.charCodeAt(1);
  if (c1 < 65 || c1 > 90 || c2 < 65 || c2 > 90) return '🌍';
  return String.fromCodePoint(A + (c1 - base), A + (c2 - base));
}
// Backward compatibility if any older code still references this name
const flagEmojiFromCountry = flagEmojiFromCountryCode;

function safeParseMs(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

// Supports patterns like: "Cape Town, Western Cape", "Lagos - Ikeja", "Nairobi • Westlands"
function parseLocationParts(raw: string) {
  const s = cleanText(raw || '');
  const byComma = s.split(',').map((x) => x.trim()).filter(Boolean);
  if (byComma.length >= 2) return { city: byComma[0], region: byComma.slice(1).join(', ') };

  const byDot = s.split('•').map((x) => x.trim()).filter(Boolean);
  if (byDot.length >= 2) return { city: byDot[0], region: byDot.slice(1).join(' • ') };

  const byDash = s.split(' - ').map((x) => x.trim()).filter(Boolean);
  if (byDash.length >= 2) return { city: byDash[0], region: byDash.slice(1).join(' - ') };

  return { city: s, region: '' };
}

/* ---------------------------
   Stubbed “meta” (Availability + Trust block)
   - deterministic per clinician id
   - easy to replace once you wire backend fields
--------------------------- */
function hashToU32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function roundToNextMinutes(ts: number, stepMinutes = 15) {
  const stepMs = stepMinutes * 60 * 1000;
  return Math.ceil(ts / stepMs) * stepMs;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isTomorrow(d: Date, now: Date) {
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return sameDay(d, t);
}
function formatTimeHHMM(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function formatAvailabilityLabel(ts: number) {
  const now = new Date();
  const d = new Date(ts);
  if (sameDay(d, now)) return `Today ${formatTimeHHMM(d)}`;
  if (isTomorrow(d, now)) return `Tomorrow ${formatTimeHHMM(d)}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${formatTimeHHMM(d)}`;
}

function computeMeta(c: ClinicianItem) {
  // If backend provides these, use them.
  const nextAvailableAt = typeof c.nextAvailableAt === 'number' ? c.nextAvailableAt : null;
  const consultMins = typeof c.consultMins === 'number' ? c.consultMins : null;
  const followupMins = typeof c.followupMins === 'number' ? c.followupMins : null;
  const responseTimeMins = typeof c.responseTimeMins === 'number' ? c.responseTimeMins : null;

  const h = hashToU32(String(c.id));
  const now = Date.now();

  // Availability stub: within next 0.5h .. 72h (online clinicians skew sooner)
  const baseOffsetMin = c.online ? 20 + (h % 90) : 90 + (h % 36) * 30; // online: 20..110min, offline: 90..(90+1050)min
  const slotTs = roundToNextMinutes(now + baseOffsetMin * 60 * 1000, 15);

  const computedNext = nextAvailableAt ?? slotTs;

  // Trust stub values (deterministic)
  const cM = consultMins ?? (12 + (h % 17)); // 12..28
  const fM = followupMins ?? clamp(cM - (2 + (h % 6)), 8, 25); // slightly shorter
  const rM = responseTimeMins ?? (30 + (h % 210)); // 30..239 minutes

  return {
    nextAvailableAt: computedNext,
    consultMins: cM,
    followupMins: fM,
    responseTimeMins: rM,
  };
}

/* ---------------------------
   SWR fetcher (ok-aware)
--------------------------- */
async function fetcher(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  let j: any = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  if (!r.ok) {
    const msg = j?.error ? String(j.error) : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return j;
}

/* ---------------------------
   Fairness comparator & helpers
--------------------------- */
function bookingPenaltyMs(clin: ClinicianItem, now = Date.now()) {
  const lastBookedAt = clin.lastBookedAt ?? 0;
  if (!lastBookedAt) return 0;
  const age = now - lastBookedAt;
  if (age <= 0) return BOOKED_COUNT_PENALTY_WEIGHT + BOOKING_PENALTY_WINDOW_MS;
  if (age >= BOOKING_DECAY_MS) return 0;
  return Math.max(0, BOOKING_DECAY_MS - age);
}
function bookedCountPenaltyMs(clin: ClinicianItem) {
  const cnt = clin.recentBookedCount ?? 0;
  return cnt * BOOKED_COUNT_PENALTY_WEIGHT;
}
function sortByFairness(a: ClinicianItem, b: ClinicianItem) {
  const statusRank = (s?: string) => {
    if (!s || s === 'active' || s === 'pending') return 0;
    if (s === 'disciplinary') return 1;
    if (s === 'disabled' || s === 'archived') return 2;
    return 0;
  };
  const srA = statusRank((a as any).status);
  const srB = statusRank((b as any).status);
  if (srA !== srB) return srA - srB;

  if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1;

  const bothOnline = Boolean(a.online) && Boolean(b.online);
  if (bothOnline) {
    const seqA = a.onlineSeq ?? Number.POSITIVE_INFINITY;
    const seqB = b.onlineSeq ?? Number.POSITIVE_INFINITY;
    if (seqA !== seqB) return seqA - seqB;
  } else {
    const sA = a.lastSeenAt ?? 0;
    const sB = b.lastSeenAt ?? 0;
    if (sA !== sB) return sB - sA;
  }

  const now = Date.now();
  const penA = bookingPenaltyMs(a, now) + bookedCountPenaltyMs(a);
  const penB = bookingPenaltyMs(b, now) + bookedCountPenaltyMs(b);
  if (penA !== penB) return penA - penB;

  const rA = a.rating ?? 0;
  const rB = b.rating ?? 0;
  if (rA !== rB) return rB - rA;

  return (a.name ?? '').localeCompare(b.name ?? '');
}

/* ---------------------------
   Country param normalization
--------------------------- */
function normalizeCountryParam(v: string | null): CountryCode | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();

  // backward-compat aliases
  const alias: Record<string, string> = {
    UK: 'GB',
    USA: 'US',
    DRC: 'CD',
  };
  const code = (alias[s] ?? s) as CountryCode;

  if ((COUNTRY_LABELS as any)[code]) return code;
  return null;
}

function mapMockToItem(country: CountryCode, c: any): ClinicianItem {
  const priceCents = typeof c.priceCents === 'number' ? c.priceCents : undefined;
  const currency = typeof c.currency === 'string' ? c.currency : undefined;

  const rating = typeof c.rating === 'number' ? c.rating : Number(c.rating ?? 0);
  const ratingCount =
    typeof c.ratingCount === 'number'
      ? c.ratingCount
      : typeof c.reviewCount === 'number'
        ? c.reviewCount
        : typeof c.ratingsCount === 'number'
          ? c.ratingsCount
          : undefined;

  const joinedAt = safeParseMs(c.joinedAt) ?? safeParseMs(c.createdAt) ?? safeParseMs(c.onboardedAt) ?? null;

  return {
    id: String(c.id ?? `${c.name}-${Math.random()}`),
    name: cleanText(c.name ?? ''),
    specialty: cleanText(c.specialty ?? ''),
    location: cleanText(c.location ?? ''),
    rating: Number.isFinite(rating) ? rating : 0,
    ratingCount,
    online: Boolean(c.online),
    cls: c.cls ?? 'Doctor',

    priceCents,
    currency,
    priceZAR:
      typeof c.priceZAR === 'number'
        ? c.priceZAR
        : country === 'ZA' && typeof priceCents === 'number'
          ? Math.round(priceCents / 100)
          : undefined,

    gender: c.gender,
    lastBookedAt: null,
    lastSeenAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 7),
    onlineSeq: c.online ? Math.floor(Math.random() * 1000) + 1 : null,
    recentBookedCount: 0,
    status: (c as any).status ?? 'active',
    acceptsMedicalAid: typeof c.acceptsMedicalAid === 'boolean' ? c.acceptsMedicalAid : !!(c as any).medicalAidAccepted,
    acceptedSchemes: Array.isArray(c.acceptedSchemes) ? c.acceptedSchemes : [],
    practiceName: c.practiceName ?? undefined,

    country,
    speaks: Array.isArray(c.speaks) ? c.speaks : undefined,
    yearsExp:
      typeof c.yearsExp === 'number' ? c.yearsExp : typeof c.yearsExperience === 'number' ? c.yearsExperience : undefined,

    joinedAt,

    // optional future fields (if mocks start carrying them)
    nextAvailableAt: safeParseMs(c.nextAvailableAt),
    consultMins: typeof c.consultMins === 'number' ? c.consultMins : null,
    followupMins: typeof c.followupMins === 'number' ? c.followupMins : null,
    responseTimeMins: typeof c.responseTimeMins === 'number' ? c.responseTimeMins : null,
  };
}

function mapApiToItem(c: any): ClinicianItem {
  const rating = typeof c.rating === 'number' ? c.rating : Number(c.rating ?? 0);
  const ratingCount =
    typeof c.ratingCount === 'number'
      ? c.ratingCount
      : typeof c.reviewCount === 'number'
        ? c.reviewCount
        : typeof c.ratingsCount === 'number'
          ? c.ratingsCount
          : typeof c.totalRatings === 'number'
            ? c.totalRatings
            : undefined;

  const joinedAt =
    safeParseMs(c.joinedAt) ??
    safeParseMs(c.createdAt) ??
    safeParseMs(c.onboardedAt) ??
    safeParseMs(c.profile?.createdAt) ??
    null;

  return {
    ...c,
    id: String(c.id ?? c.slug ?? `${c.name}-${Math.random()}`),
    name: cleanText(c.name ?? ''),
    specialty: cleanText(c.specialty ?? ''),
    location: cleanText(c.location ?? ''),
    rating: Number.isFinite(rating) ? rating : 0,
    ratingCount,
    online: Boolean(c.online),

    priceZAR:
      typeof c.priceZAR === 'number'
        ? c.priceZAR
        : typeof c.feeCents === 'number'
          ? Math.round(c.feeCents / 100)
          : undefined,

    lastBookedAt:
      typeof c.lastBookedAt === 'number' ? c.lastBookedAt : c.lastBookedAt ? Date.parse(c.lastBookedAt) : c.lastBookedAt ?? null,
    lastSeenAt:
      typeof c.lastSeenAt === 'number' ? c.lastSeenAt : c.lastSeenAt ? Date.parse(c.lastSeenAt) : c.lastSeenAt ?? null,
    onlineSeq: typeof c.onlineSeq === 'number' ? c.onlineSeq : c.onlineSeq ?? null,
    recentBookedCount: typeof c.recentBookedCount === 'number' ? c.recentBookedCount : 0,

    status: c.status ?? c.clinicianStatus ?? c.profile?.status ?? 'active',
    acceptsMedicalAid: typeof c.acceptsMedicalAid === 'boolean' ? c.acceptsMedicalAid : !!c.medicalAidAccepted,
    acceptedSchemes: Array.isArray(c.acceptedSchemes)
      ? c.acceptedSchemes
      : typeof c.acceptedSchemesCsv === 'string'
        ? String(c.acceptedSchemesCsv)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    practiceName: c.practiceName ?? c.practice ?? undefined,

    country: normalizeCountryParam(c.country ?? null) ?? 'ZA',
    speaks: Array.isArray(c.speaks) ? c.speaks : Array.isArray(c.languages) ? c.languages : undefined,
    yearsExp: typeof c.yearsExp === 'number' ? c.yearsExp : typeof c.yearsExperience === 'number' ? c.yearsExperience : undefined,

    joinedAt,

    // optional future backend fields:
    nextAvailableAt: safeParseMs(c.nextAvailableAt) ?? safeParseMs(c.nextSlotAt) ?? null,
    consultMins: typeof c.consultMins === 'number' ? c.consultMins : typeof c.avgConsultMins === 'number' ? c.avgConsultMins : null,
    followupMins: typeof c.followupMins === 'number' ? c.followupMins : typeof c.followUpMins === 'number' ? c.followUpMins : null,
    responseTimeMins: typeof c.responseTimeMins === 'number' ? c.responseTimeMins : typeof c.avgResponseMins === 'number' ? c.avgResponseMins : null,
  };
}

/* ---------------------------
   UI: Stars (5-star display with partial fill)
--------------------------- */
const Star: React.FC<{ fillPct: number }> = ({ fillPct }) => {
  const pct = clamp(fillPct, 0, 1) * 100;
  return (
    <span className="relative inline-block h-4 w-4" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300">
        <path fill="currentColor" d="M12 17.3l-6.18 3.4 1.18-6.87L2 9.1l6.9-1L12 1.8l3.1 6.3 6.9 1-5 4.73 1.18 6.87z" />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500">
          <path fill="currentColor" d="M12 17.3l-6.18 3.4 1.18-6.87L2 9.1l6.9-1L12 1.8l3.1 6.3 6.9 1-5 4.73 1.18 6.87z" />
        </svg>
      </span>
    </span>
  );
};

const RatingRow: React.FC<{ rating?: number; count?: number }> = ({ rating, count }) => {
  const r = typeof rating === 'number' && Number.isFinite(rating) ? clamp(rating, 0, 5) : 0;
  return (
    <div className="flex items-center gap-2 mt-1" aria-label={`Rating ${r.toFixed(1)}`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = clamp(r - i, 0, 1);
          return <Star key={i} fillPct={fill} />;
        })}
      </div>
      <div className="text-xs text-slate-700">
        <span className="font-medium text-slate-900">{r.toFixed(1)}</span>
        {typeof count === 'number' ? <span className="text-slate-500"> · {count.toLocaleString()} rated</span> : null}
      </div>
    </div>
  );
};

const Chip: React.FC<{ label: string; onRemove?: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs text-slate-700 shadow-sm">
    <span className="max-w-[220px] truncate">{label}</span>
    {onRemove ? (
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full px-1 text-slate-500 hover:text-slate-900"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    ) : null}
  </span>
);

/* ---------------------------
   Page component
--------------------------- */
export default function CliniciansPage() {
  const router = useRouter();
  const { isPremium } = usePlan();
  const sp = useSearchParams();
  const bootstrappedRef = useRef(false);
  const fallbackToastRef = useRef(false);

  const [country, setCountry] = useState<CountryCode>(normalizeCountryParam(sp.get('country')) ?? 'ZA');
  const [tab, setTab] = useState<UIClass>('Doctors');

  const [filters, setFilters] = useState<{
    q: string;
    sort: 'rating-desc' | 'name' | 'price' | 'soonest';
    specialty: string;
    gender: string;

    region: string;
    city: string;

    price: number;
    acceptsMedicalAid: '' | 'yes' | 'no';

    previouslyConsulted: '' | 'yes';
    languages: string[];
    minYearsExp: number;
  }>({
    q: '',
    sort: 'rating-desc',
    specialty: '',
    gender: '',
    region: '',
    city: '',
    price: 5000,
    acceptsMedicalAid: '',
    previouslyConsulted: '',
    languages: [],
    minYearsExp: 0,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [favs, setFavs] = useState<string[]>([]);
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  // Compare drawer
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // Modal state for upsell (generic)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [modalClinician, setModalClinician] = useState<{ id: string; name: string } | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string>('');

  // Encounter counts (patient → clinician consultations)
  const [encounterCounts, setEncounterCounts] = useState<Record<string, number>>({});

  // Sticky toolbar shadow
  const [scrolled, setScrolled] = useState(false);

  const openUpgrade = useCallback((reason: string, clinician?: { id: string; name: string } | null) => {
    setUpgradeReason(reason);
    setModalClinician(clinician ?? null);
    setUpgradeModalOpen(true);
  }, []);

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  // bootstrap from URL once
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const get = (k: string) => sp.get(k) ?? '';
    const cls = normalizeClassParam(get('class'));
    const qText = get('q');
    const onlineParam = get('online');
    const online = onlineParam === '1' || onlineParam?.toLowerCase() === 'true';

    const gender = get('gender');
    const specFirst = (get('specialties') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];

    const ctry = normalizeCountryParam(get('country'));
    if (ctry) setCountry(ctry);

    if (cls) setTab(cls);
    setFilters((prev) => ({
      ...prev,
      q: qText || prev.q,
      gender: gender || prev.gender,
      specialty: specFirst || prev.specialty,
    }));
    if (online) setOnlineOnly(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // sticky shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // load favourites from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavs(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    } catch {}
  }, [favs]);

  // compare pins are PREMIUM-only: never load/save for free users
  useEffect(() => {
    if (!isPremium) {
      setCompareIds([]);
      setCompareOpen(false);
      try {
        localStorage.removeItem(COMPARE_KEY);
      } catch {}
      return;
    }

    try {
      const raw = localStorage.getItem(COMPARE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCompareIds(parsed.map(String).slice(0, 3));
      }
    } catch {}
  }, [isPremium]);

  useEffect(() => {
    if (!isPremium) return;
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds.slice(0, 3)));
    } catch {}
  }, [compareIds, isPremium]);

  // If user is not premium, scrub premium-only filters and premium-only sort
  useEffect(() => {
    if (isPremium) return;

    setFilters((f) => ({
      ...f,
      languages: [],
      minYearsExp: 0,
      previouslyConsulted: '',
      sort: f.sort === 'soonest' ? 'rating-desc' : f.sort,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  const toggleFav = useCallback(
    (id: string) => setFavs((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id])),
    [],
  );

  const toggleCompare = useCallback(
    (c: ClinicianItem) => {
      if (!isPremium) return openUpgrade('Clinician comparison', { id: c.id, name: c.name });

      setCompareIds((prev) => {
        const id = c.id;
        const exists = prev.includes(id);
        if (exists) return prev.filter((x) => x !== id);
        if (prev.length >= 3) {
          toast('You can compare up to 3 clinicians', 'info');
          return prev;
        }
        return [...prev, id];
      });
    },
    [isPremium, openUpgrade],
  );

  const setSortSafe = useCallback(
    (nextSort: 'rating-desc' | 'name' | 'price' | 'soonest') => {
      if (nextSort === 'soonest' && !isPremium) {
        openUpgrade('Next availability sorting');
        return;
      }
      setFilters((f) => ({ ...f, sort: nextSort }));
    },
    [isPremium, openUpgrade],
  );

  // ✅ Use API only for ZA; other countries instantly show their mock datasets.
  const useApi = country === 'ZA';
  const apiUrl = useApi ? `/api/clinicians?page=1&perPage=500` : null;

  const { data, error, isValidating } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [allClinicians, setAllClinicians] = useState<ClinicianItem[]>([]);

  // Non-ZA: instantly populate with mocks
  useEffect(() => {
    if (useApi) return;
    const fallback = getMockCliniciansForCountry(country).map((c: any) => mapMockToItem(country, c));
    setAllClinicians(fallback);
    setPage(1);
  }, [country, useApi]);

  // ZA API path (fallback to ZA mocks on error OR empty OR ok:false)
  useEffect(() => {
    if (!useApi) return;

    const applyZaFallback = (why: string) => {
      const fallback = getMockCliniciansForCountry('ZA').map((c: any) => mapMockToItem('ZA', c));
      setAllClinicians(fallback);
      setPage(1);

      if (!fallbackToastRef.current) {
        fallbackToastRef.current = true;
        try {
          toast(`Using demo clinician data (${why})`, 'info');
        } catch {}
      }
    };

    if (data) {
      if (data?.ok === false) {
        applyZaFallback('API said ok:false');
        return;
      }

      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.clinicians)
          ? data.clinicians
          : Array.isArray(data?.items)
            ? data.items
            : [];

      if (!list.length) {
        applyZaFallback('no clinicians returned');
        return;
      }

      setAllClinicians(list.map(mapApiToItem));
      return;
    }

    if (error) applyZaFallback('offline');
  }, [data, error, useApi]);

  const loading = useApi ? isValidating && !data && !allClinicians.length : false;

  // Listen to server-sent events for presence and booking updates (ZA API mode)
  useEffect(() => {
    if (!useApi) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/clinicians/events');
    } catch {
      es = null;
    }
    if (!es) return;

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload || !payload.type) return;

        if (payload.type === 'presence' || payload.type === 'booked' || payload.type === 'clinician.update') {
          globalMutate(
            apiUrl!,
            (current: any) => {
              const arr: any[] = Array.isArray(current)
                ? current
                : Array.isArray(current?.clinicians)
                  ? current.clinicians
                  : Array.isArray(current?.items)
                    ? current.items
                    : [];

              const mapped = arr.map((c) => {
                if (String(c.id) !== String(payload.clinicianId)) return c;

                const updated: any = { ...c, ...payload.updates };

                if (payload.lastBookedAt) updated.lastBookedAt = typeof payload.lastBookedAt === 'number' ? payload.lastBookedAt : Date.parse(payload.lastBookedAt);
                if (payload.lastSeenAt) updated.lastSeenAt = typeof payload.lastSeenAt === 'number' ? payload.lastSeenAt : Date.parse(payload.lastSeenAt);
                if (typeof payload.online !== 'undefined') updated.online = Boolean(payload.online);
                if (typeof payload.onlineSeq !== 'undefined') updated.onlineSeq = payload.onlineSeq;
                if (typeof payload.recentBookedCount !== 'undefined') updated.recentBookedCount = payload.recentBookedCount;

                if (typeof payload.acceptsMedicalAid !== 'undefined') updated.acceptsMedicalAid = payload.acceptsMedicalAid;
                if (Array.isArray(payload.acceptedSchemes)) updated.acceptedSchemes = payload.acceptedSchemes;
                if (typeof payload.practiceName !== 'undefined') updated.practiceName = payload.practiceName;

                if (typeof payload.status !== 'undefined') updated.status = payload.status;
                if (typeof payload.clinicianStatus !== 'undefined') updated.status = payload.clinicianStatus;

                if (typeof payload.yearsExp !== 'undefined') updated.yearsExp = payload.yearsExp;
                if (Array.isArray(payload.speaks)) updated.speaks = payload.speaks;

                if (typeof payload.rating !== 'undefined') updated.rating = payload.rating;
                if (typeof payload.ratingCount !== 'undefined') updated.ratingCount = payload.ratingCount;

                if (typeof payload.joinedAt !== 'undefined') updated.joinedAt = safeParseMs(payload.joinedAt);

                if (typeof payload.nextAvailableAt !== 'undefined') updated.nextAvailableAt = safeParseMs(payload.nextAvailableAt);
                if (typeof payload.consultMins !== 'undefined') updated.consultMins = payload.consultMins;
                if (typeof payload.followupMins !== 'undefined') updated.followupMins = payload.followupMins;

                updated.name = cleanText(updated.name ?? '');
                updated.specialty = cleanText(updated.specialty ?? '');
                updated.location = cleanText(updated.location ?? '');
                return updated;
              });

              const found = mapped.some((c) => String(c.id) === String(payload.clinicianId));
              if (!found && payload.full) mapped.push(payload.full);
              return { ...(current ?? {}), clinicians: mapped, items: mapped };
            },
            false,
          );
        }
      } catch (err) {
        console.warn('Failed to parse clinician event', err);
      }
    };

    es.onerror = (err) => console.warn('Clinician events stream error', err);
    return () => es?.close();
  }, [useApi, apiUrl]);

  /* ---------------------------
     Encounter counts (best-effort)
  --------------------------- */
  const encountersApiUrl = useMemo(() => `/api/encounters/clinicians-counts?country=${country}`, [country]);
  const { data: encounterData } = useSWR(encountersApiUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENCOUNTER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setEncounterCounts((prev) => ({ ...prev, ...parsed }));
    } catch {}
  }, [country]);

  useEffect(() => {
    if (!encounterData) return;
    const counts = (encounterData?.counts ?? encounterData) as any;
    if (!counts || typeof counts !== 'object') return;

    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts)) {
      const n = typeof v === 'number' ? v : Number(v ?? 0);
      next[String(k)] = Number.isFinite(n) ? n : 0;
    }
    setEncounterCounts((prev) => ({ ...prev, ...next }));

    try {
      localStorage.setItem(ENCOUNTER_KEY, JSON.stringify({ ...encounterCounts, ...next }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterData]);

  // compute scoped clinicians (class filter)
  const scoped = useMemo(
    () =>
      allClinicians.filter((c) => {
        const clsMatch = (c.cls ?? c?.cls) === toDataClass(tab) || (c.cls == null && toDataClass(tab) === 'Doctor');
        const status = (c.status ?? 'active') as string;
        const visible = status !== 'archived' && status !== 'deleted';
        return clsMatch && visible;
      }),
    [allClinicians, tab],
  );

  // parsed location cache for filters
  const locPartsById = useMemo(() => {
    const out: Record<string, { city: string; region: string }> = {};
    for (const c of scoped) out[c.id] = parseLocationParts(c.location);
    return out;
  }, [scoped]);

  // Derive dropdown options safely
  useEffect(() => {
    const val = <T,>(arr: T[]) => new Set(arr.filter(Boolean) as T[]);
    const validSpecialties = val(scoped.map((c) => c.specialty));
    const validGenders = val(scoped.map((c) => (c.gender || '').trim()));
    const validRegions = val(scoped.map((c) => locPartsById[c.id]?.region || '').filter(Boolean));

    const validCities = new Set(
      scoped
        .map((c) => locPartsById[c.id])
        .filter(Boolean)
        .filter((p) => (filters.region ? p.region === filters.region : true))
        .map((p) => p.city)
        .filter(Boolean),
    );

    setFilters((prev) => ({
      ...prev,
      specialty: validSpecialties.has(prev.specialty) ? prev.specialty : '',
      gender: validGenders.has(prev.gender) ? prev.gender : '',
      region: validRegions.has(prev.region) ? prev.region : '',
      city: prev.city && validCities.has(prev.city) ? prev.city : '',
    }));
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, locPartsById]);

  const toggleOnline = useCallback(() => {
    if (!isPremium) return toast('Online-now filter is a Premium feature', 'error');
    setOnlineOnly((v) => !v);
    setPage(1);
  }, [isPremium]);

  useEffect(() => {
    setPage(1);
  }, [
    country,
    debouncedQ,
    filters.sort,
    filters.specialty,
    filters.gender,
    filters.region,
    filters.city,
    filters.price,
    filters.acceptsMedicalAid,
    filters.previouslyConsulted,
    filters.minYearsExp,
    filters.languages,
    showFavsOnly,
    onlineOnly,
  ]);

  // filter first (search/filter) then apply sorting
  const allFiltered = useMemo(() => {
    let L = scoped.slice();
    const q = debouncedQ.toLowerCase();

    if (q) {
      L = L.filter((c) => {
        const p = locPartsById[c.id] ?? { city: '', region: '' };
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.specialty || '').toLowerCase().includes(q) ||
          (c.location || '').toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.region || '').toLowerCase().includes(q) ||
          (c.practiceName || '').toLowerCase().includes(q) ||
          (Array.isArray(c.acceptedSchemes) ? c.acceptedSchemes.join(' ').toLowerCase().includes(q) : false) ||
          (isPremium && Array.isArray(c.speaks) ? c.speaks.join(' ').toLowerCase().includes(q) : false)
        );
      });
    }

    if (filters.specialty) L = L.filter((c) => c.specialty === filters.specialty);
    if (filters.gender) L = L.filter((c) => (c.gender || '').trim() === filters.gender);

    if (filters.region) L = L.filter((c) => (locPartsById[c.id]?.region || '') === filters.region);
    if (filters.city) L = L.filter((c) => (locPartsById[c.id]?.city || '') === filters.city);

    if (filters.price) {
      L = L.filter((c) => {
        const zar = typeof c.priceZAR === 'number' ? c.priceZAR : undefined;
        if (typeof zar === 'number') return zar <= filters.price;
        if (typeof c.priceCents === 'number') return c.priceCents / 100 <= filters.price;
        return true;
      });
    }

    if (onlineOnly) L = L.filter((c) => c.online);
    if (showFavsOnly) L = L.filter((c) => favs.includes(c.id));

    if (filters.acceptsMedicalAid === 'yes') L = L.filter((c) => c.acceptsMedicalAid);
    if (filters.acceptsMedicalAid === 'no') L = L.filter((c) => !c.acceptsMedicalAid);

    // Premium-only filters
    if (isPremium && filters.previouslyConsulted === 'yes') L = L.filter((c) => (encounterCounts[c.id] ?? 0) > 0);

    if (isPremium && filters.languages.length > 0) {
      const wanted = new Set(filters.languages.map((x) => x.toLowerCase()));
      L = L.filter((c) => {
        const speaks = (Array.isArray(c.speaks) ? c.speaks : []).map((x) => String(x).toLowerCase());
        const have = new Set(speaks);
        for (const w of wanted) if (!have.has(w)) return false;
        return true;
      });
    }

    if (isPremium && filters.minYearsExp > 0) {
      L = L.filter((c) => (typeof c.yearsExp === 'number' ? c.yearsExp : 0) >= filters.minYearsExp);
    }

    // Precompute meta for sorting when needed
    const metaById: Record<string, ReturnType<typeof computeMeta>> = {};
    const getMeta = (c: ClinicianItem) => (metaById[c.id] ??= computeMeta(c));

    L.sort((a, b) => {
      // Sort by soonest availability (premium only)
      if (filters.sort === 'soonest' && isPremium) {
        const ma = getMeta(a);
        const mb = getMeta(b);
        const ta = ma.nextAvailableAt ?? Number.POSITIVE_INFINITY;
        const tb = mb.nextAvailableAt ?? Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;

        const f = sortByFairness(a, b);
        if (f !== 0) return f;
        return (b.rating ?? 0) - (a.rating ?? 0);
      }

      const f = sortByFairness(a, b);
      if (f !== 0) return f;

      switch (filters.sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price': {
          const ap = (typeof a.priceZAR === 'number' ? a.priceZAR : (a.priceCents ?? 0) / 100) ?? 0;
          const bp = (typeof b.priceZAR === 'number' ? b.priceZAR : (b.priceCents ?? 0) / 100) ?? 0;
          return ap - bp;
        }
        default:
          return (b.rating ?? 0) - (a.rating ?? 0);
      }
    });

    return L;
  }, [scoped, debouncedQ, filters, onlineOnly, showFavsOnly, favs, locPartsById, encounterCounts, isPremium]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allFiltered.slice(start, start + PAGE_SIZE);
  }, [allFiltered, page]);

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));

  const specialties = useMemo(() => Array.from(new Set(scoped.map((c) => c.specialty))).filter(Boolean) as string[], [scoped]);
  const genders = useMemo(() => {
    const set = new Set(scoped.map((c) => (c.gender || '').trim()).filter(Boolean));
    const from = Array.from(set);
    return from.length ? from : ['Male', 'Female', 'Other'];
  }, [scoped]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const c of scoped) {
      const r = locPartsById[c.id]?.region;
      if (r) set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scoped, locPartsById]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const c of scoped) {
      const p = locPartsById[c.id];
      if (!p?.city) continue;
      if (filters.region && p.region !== filters.region) continue;
      set.add(p.city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scoped, locPartsById, filters.region]);

  // NOTE: languages list is PREMIUM-only to avoid leaking languages on free tier
  const languagesAll = useMemo(() => {
    if (!isPremium) return [];
    const set = new Set<string>();
    for (const c of scoped) {
      (Array.isArray(c.speaks) ? c.speaks : []).forEach((s) => {
        const t = String(s || '').trim();
        if (t) set.add(t);
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scoped, isPremium]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.specialty) n++;
    if (filters.gender) n++;
    if (filters.region) n++;
    if (filters.city) n++;
    if (filters.price < 5000) n++;
    if (filters.acceptsMedicalAid) n++;
    if (onlineOnly) n++;
    if (showFavsOnly) n++;

    if (isPremium) {
      if (filters.previouslyConsulted) n++;
      if (filters.languages.length) n++;
      if (filters.minYearsExp > 0) n++;
    }

    return n;
  }, [filters, onlineOnly, showFavsOnly, isPremium]);

  const resetFilters = useCallback(() => {
    setFilters({
      q: '',
      sort: 'rating-desc',
      specialty: '',
      gender: '',
      region: '',
      city: '',
      price: 5000,
      acceptsMedicalAid: '',
      previouslyConsulted: '',
      languages: [],
      minYearsExp: 0,
    });
    setShowFavsOnly(false);
    setOnlineOnly(false);
    setPage(1);
  }, []);

  const removeChip = useCallback((key: string, value?: string) => {
    setFilters((f) => {
      switch (key) {
        case 'q':
          return { ...f, q: '' };
        case 'specialty':
          return { ...f, specialty: '' };
        case 'gender':
          return { ...f, gender: '' };
        case 'region':
          return { ...f, region: '', city: '' };
        case 'city':
          return { ...f, city: '' };
        case 'price':
          return { ...f, price: 5000 };
        case 'acceptsMedicalAid':
          return { ...f, acceptsMedicalAid: '' };
        case 'previouslyConsulted':
          return { ...f, previouslyConsulted: '' };
        case 'minYearsExp':
          return { ...f, minYearsExp: 0 };
        case 'lang':
          return { ...f, languages: f.languages.filter((x) => x !== value) };
        default:
          return f;
      }
    });

    if (key === 'onlineOnly') setOnlineOnly(false);
    if (key === 'showFavsOnly') setShowFavsOnly(false);
  }, []);

  const activeChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];

    if (filters.q.trim()) chips.push({ label: `Search: ${filters.q.trim()}`, onRemove: () => removeChip('q') });
    if (filters.specialty) chips.push({ label: `Specialty: ${filters.specialty}`, onRemove: () => removeChip('specialty') });
    if (filters.gender) chips.push({ label: `Gender: ${filters.gender}`, onRemove: () => removeChip('gender') });
    if (filters.region) chips.push({ label: `Region: ${filters.region}`, onRemove: () => removeChip('region') });
    if (filters.city) chips.push({ label: `City: ${filters.city}`, onRemove: () => removeChip('city') });
    if (filters.price < 5000) chips.push({ label: `Up to ${filters.price}`, onRemove: () => removeChip('price') });
    if (filters.acceptsMedicalAid === 'yes') chips.push({ label: 'Accepts Medical Aid', onRemove: () => removeChip('acceptsMedicalAid') });
    if (filters.acceptsMedicalAid === 'no') chips.push({ label: 'Private pay only', onRemove: () => removeChip('acceptsMedicalAid') });

    if (isPremium) {
      if (filters.previouslyConsulted === 'yes') chips.push({ label: 'Previously consulted', onRemove: () => removeChip('previouslyConsulted') });
      if (filters.minYearsExp > 0) chips.push({ label: `≥ ${filters.minYearsExp} yrs exp`, onRemove: () => removeChip('minYearsExp') });
      for (const lang of filters.languages) chips.push({ label: `Lang: ${lang}`, onRemove: () => removeChip('lang', lang) });
    }

    if (onlineOnly) chips.push({ label: 'Online now', onRemove: () => removeChip('onlineOnly') });
    if (showFavsOnly) chips.push({ label: 'Favourites only', onRemove: () => removeChip('showFavsOnly') });

    return chips;
  }, [filters, onlineOnly, showFavsOnly, removeChip, isPremium]);

  const SkeletonRow = () => (
    <div className="p-4 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="space-y-1">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-64 bg-gray-100 rounded mt-1" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-6 w-12 bg-gray-200 rounded" />
        <div className="h-8 w-24 bg-gray-200 rounded" />
      </div>
    </div>
  );

  const HeartButton: React.FC<{ fav: boolean; onClick: () => void; label: string }> = ({ fav, onClick, label }) => (
    <button onClick={onClick} aria-pressed={fav} aria-label={label} className="relative p-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-1" type="button">
      <span className={`heart ${fav ? 'liked' : 'unliked'}`} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <defs>
            <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff8da1" />
              <stop offset="100%" stopColor="#ff3b6f" />
            </linearGradient>
          </defs>

          <path
            className="heart-fill"
            d="M12 21s-7.5-4.9-9.2-7C1.5 11 4 7 7.5 7 9.2 7 10 8 12 9.5 14 8 14.8 7 16.5 7 20 7 22.5 11 21.2 14c-1.7 2.1-9.2 7-9.2 7z"
            fill="url(#g1)"
            opacity={fav ? 1 : 0}
            style={{ transition: 'opacity .18s linear, transform .22s cubic-bezier(.2,.9,.3,1)' }}
          />
          <path
            className="heart-outine"
            d="M16.5 7c-1.7 0-2.5 1-4.5 2.5C9.5 8 8.7 7 7 7 3.5 7 1 11 2.3 14c1.7 2.1 9.2 7 9.7 7 .5 0 7.9-4.9 9.7-7C23 11 20.5 7 16.5 7z"
            fill="none"
            stroke={fav ? '#ff3b6f' : '#9ca3af'}
            strokeWidth="1.25"
            style={{ transition: 'stroke .18s linear' }}
          />
        </svg>
      </span>

      <span className={`absolute -top-2 -right-2 sparkle ${fav ? 'show' : ''}`} aria-hidden>
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path d="M12 2 L13 8 L19 9 L13 11 L12 18 L11 11 L5 9 L11 8 Z" fill="#ffd166" opacity={fav ? 1 : 0} />
        </svg>
      </span>

      <style jsx>{`
        .heart {
          display: inline-block;
          line-height: 0;
        }
        .sparkle {
          transform-origin: center;
          transition: transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.18s;
          opacity: 0;
          transform: scale(0.6);
        }
        .sparkle.show {
          opacity: 1;
          transform: scale(1.05);
          animation: sparklePop 0.42s ease-out;
        }
        @keyframes sparklePop {
          0% {
            transform: scale(0.6) rotate(0deg);
            opacity: 0;
          }
          40% {
            transform: scale(1.25) rotate(18deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );

  const UpgradeModal: React.FC = () => {
    if (!upgradeModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setUpgradeModalOpen(false)} />
        <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6 z-10">
          <h2 className="text-lg font-semibold">Premium required</h2>
          <p className="mt-2 text-sm text-gray-600">
            {upgradeReason ? (
              <>
                <span className="font-medium text-gray-900">{upgradeReason}</span> is a Premium feature. Please upgrade to Premium Plan to access it.
              </>
            ) : (
              <>You are currently on a free plan. Please upgrade to Premium Plan to access this function.</>
            )}
          </p>

          {modalClinician ? (
            <div className="mt-3 text-sm">
              Alternatively, click{' '}
              <Link href={`/clinicians/${modalClinician.id}`} className="underline text-teal-700">
                View
              </Link>{' '}
              to access Clinician Calendar for booking.
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-3">
            <button onClick={() => setUpgradeModalOpen(false)} className="px-3 py-1 rounded border text-sm text-gray-700 hover:bg-gray-50" type="button">
              Close
            </button>
            <button onClick={() => router.push('/pricing')} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700" type="button">
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCalendarClick = useCallback(
    (c: ClinicianItem) => {
      const status = (c.status ?? 'active') as string;
      if (status === 'disabled' || status === 'archived') {
        toast('This clinician is not accepting new bookings via Ambulant+ at the moment.', 'info');
        return;
      }

      if (!isPremium) {
        openUpgrade('Booking via calendar', { id: c.id, name: c.name });
        return;
      }

      router.push(`/clinicians/${c.id}/calendar?country=${country}`);
    },
    [isPremium, router, country, openUpgrade],
  );

  const toggleLanguage = useCallback(
    (lang: string) => {
      if (!isPremium) return openUpgrade('Languages spoken filter');
      setFilters((f) => {
        const exists = f.languages.includes(lang);
        return { ...f, languages: exists ? f.languages.filter((x) => x !== lang) : [...f.languages, lang] };
      });
    },
    [isPremium, openUpgrade],
  );

  const compareClinicians = useMemo(() => {
    const byId = new Map<string, ClinicianItem>();
    for (const c of scoped) byId.set(c.id, c);
    return compareIds.map((id) => byId.get(id)).filter(Boolean) as ClinicianItem[];
  }, [compareIds, scoped]);

  const CompareDrawer: React.FC = () => {
    if (!compareOpen || !isPremium) return null;
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={() => setCompareOpen(false)} />
        <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl border-t max-h-[85vh] overflow-auto">
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Compare clinicians</div>
              <div className="text-xs text-slate-500">Pin up to 3 clinicians to compare side-by-side.</div>
            </div>
            <button type="button" onClick={() => setCompareOpen(false)} className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-slate-50">
              Close
            </button>
          </div>

          {compareClinicians.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">No clinicians pinned yet.</div>
          ) : (
            <div className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="hidden md:block" />
                {compareClinicians.map((c) => {
                  const meta = computeMeta(c);
                  const priceStr = formatMoney(c.currency, c.priceCents, c.priceZAR);
                  return (
                    <div key={c.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{c.name}</div>
                          <div className="text-xs text-slate-500 truncate">{c.specialty}</div>
                        </div>
                        <button type="button" className="text-xs px-2 py-1 rounded-lg border hover:bg-slate-50" onClick={() => toggleCompare(c)}>
                          Remove
                        </button>
                      </div>

                      <div className="mt-2 text-xs text-slate-700">
                        {meta.nextAvailableAt ? (
                          <div className="inline-flex items-center rounded-full border bg-slate-50 px-2 py-0.5">
                            Availability: <span className="ml-1 font-medium">{formatAvailabilityLabel(meta.nextAvailableAt)}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <Link href={`/clinicians/${c.id}`} className="text-xs underline text-slate-600">
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleCalendarClick(c)}
                          className="ml-auto px-3 py-1 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Book
                        </button>
                      </div>

                      {priceStr ? <div className="mt-2 text-xs text-slate-600">From <b className="text-slate-900">{priceStr}</b></div> : null}
                    </div>
                  );
                })}
              </div>

              {/* comparison table */}
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm border rounded-xl overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 border-b w-48 text-slate-600 font-medium">Field</th>
                      {compareClinicians.map((c) => (
                        <th key={c.id} className="text-left p-3 border-b min-w-[220px] font-medium text-slate-900">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: 'Availability',
                        render: (c: ClinicianItem) => {
                          const meta = computeMeta(c);
                          return meta.nextAvailableAt ? formatAvailabilityLabel(meta.nextAvailableAt) : '—';
                        },
                      },
                      {
                        label: 'Price',
                        render: (c: ClinicianItem) => formatMoney(c.currency, c.priceCents, c.priceZAR) || '—',
                      },
                      {
                        label: 'Languages',
                        render: (c: ClinicianItem) => (Array.isArray(c.speaks) && c.speaks.length ? c.speaks.join(', ') : '—'),
                      },
                      {
                        label: 'Experience',
                        render: (c: ClinicianItem) => (typeof c.yearsExp === 'number' ? `${c.yearsExp} yrs` : '—'),
                      },
                      {
                        label: 'Rating',
                        render: (c: ClinicianItem) =>
                          typeof c.rating === 'number' ? `${c.rating.toFixed(1)}${typeof c.ratingCount === 'number' ? ` (${c.ratingCount})` : ''}` : '—',
                      },
                      {
                        label: 'Trust (avg lengths)',
                        render: (c: ClinicianItem) => {
                          const meta = computeMeta(c);
                          const resp = meta.responseTimeMins;
                          const respLabel =
                            typeof resp === 'number'
                              ? resp < 60
                                ? `~${resp}m`
                                : `~${Math.round(resp / 60)}h`
                              : '—';
                          return `Consult ${meta.consultMins}m · Follow-up ${meta.followupMins}m · Response ${respLabel}`;
                        },
                      },
                    ].map((row) => (
                      <tr key={row.label} className="odd:bg-white even:bg-slate-50/40">
                        <td className="p-3 border-b text-slate-600">{row.label}</td>
                        {compareClinicians.map((c) => (
                          <td key={c.id} className="p-3 border-b text-slate-900">
                            {row.render(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className={`max-w-7xl mx-auto ${isPremium && compareIds.length ? 'pb-24' : ''}`}>
      {/* Sticky filter bar + active chips */}
      <div className={`sticky top-0 z-40 ${scrolled ? 'shadow-md' : ''}`}>
        <div className="bg-white/85 backdrop-blur border-b">
          <div className="px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link href="/auto-triage" className="text-sm text-teal-700 hover:underline shrink-0">
                  ← Back
                </Link>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-slate-900 truncate">Clinicians</h1>
                  <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">Browse and filter clinicians.</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                {/* Search always visible in sticky bar */}
                <input
                  type="text"
                  placeholder="Search…"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  className="w-[220px] max-w-[60vw] rounded-lg border px-3 py-2 text-sm bg-white"
                  aria-label="Search clinicians"
                />

                {/* Header sort: no "Rating" label here (use "Recommended") */}
                <select
                  value={filters.sort}
                  onChange={(e) => setSortSafe(e.target.value as any)}
                  className="rounded-lg border px-2 py-2 text-sm bg-white"
                  aria-label="Sort"
                >
                  <option value="rating-desc">Recommended</option>
                  <option value="soonest">Soonest available (Premium)</option>
                  <option value="price">Price</option>
                  <option value="name">Name A–Z</option>
                </select>

                {/* Country picker with flag */}
                <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-2">
                  <span className="text-base leading-none" aria-hidden title={(COUNTRY_LABELS as any)[country] ?? country}>
                    {flagEmojiFromCountryCode(country)}
                  </span>
                  <select
                    className="text-sm bg-transparent outline-none"
                    value={country}
                    onChange={(e) => setCountry(e.target.value as CountryCode)}
                    aria-label="Country"
                  >
                    {COUNTRY_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tabs */}
                {UI_CLASSES.map((c) => (
                  <div key={c} className="relative group">
                    <button
                      onClick={() => setTab(c)}
                      className={`px-3 py-2 rounded-lg border text-sm ${tab === c ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'}`}
                      aria-pressed={tab === c}
                      type="button"
                    >
                      {c}
                    </button>

                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 min-w-[180px] rounded-xl border bg-white shadow-md p-2 text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-20"
                      aria-hidden
                    >
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 px-2 pb-1">Includes</div>
                      <ul className="space-y-1">
                        {HOVER_MENUS[c].map((item) => (
                          <li key={item} className="px-2 py-1 rounded hover:bg-gray-50 cursor-default">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setShowFilters((s) => !s)}
                  className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-100"
                  aria-expanded={showFilters}
                  aria-controls="filters-panel"
                  type="button"
                >
                  Filters{' '}
                  {activeFilterCount ? <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-900 text-white">{activeFilterCount}</span> : null}
                </button>

                {activeFilterCount ? (
                  <button onClick={resetFilters} className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-100" type="button">
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {/* Active filter chips (tap to remove) */}
            {activeChips.length ? (
              <div className="mt-3 flex items-center gap-2 overflow-auto pb-1">
                {activeChips.map((c) => (
                  <Chip key={c.label} label={c.label} onRemove={c.onRemove} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Quick count */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{allFiltered.length.toLocaleString()}</span> clinicians found
          </div>

          {isPremium && compareIds.length ? (
            <button type="button" onClick={() => setCompareOpen(true)} className="text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50">
              Compare ({compareIds.length})
            </button>
          ) : null}
        </div>

        {showFilters && (
          <section id="filters-panel" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-white rounded-2xl shadow-sm border p-4">
            {/* Sort (Rating belongs in Filters) */}
            <div className="xl:col-span-4 md:col-span-2">
              <label className="text-xs text-gray-600 block">Sort</label>
              <select
                value={filters.sort}
                onChange={(e) => setSortSafe(e.target.value as any)}
                className="rounded-lg border p-2 text-sm w-full"
                aria-label="Sort clinicians"
              >
                <option value="rating-desc">Rating</option>
                <option value="price">Price</option>
                <option value="name">Name A–Z</option>
                <option value="soonest">Soonest available (Premium)</option>
              </select>
            </div>

            <select value={filters.specialty} onChange={(e) => setFilters((f) => ({ ...f, specialty: e.target.value }))} className="rounded-lg border p-2 text-sm" aria-label="Filter by specialty">
              <option value="">All Specialties</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select value={filters.gender} onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))} className="rounded-lg border p-2 text-sm" aria-label="Filter by gender">
              <option value="">Any Gender</option>
              {genders.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={filters.region}
              onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value, city: '' }))}
              className="rounded-lg border p-2 text-sm"
              aria-label="Filter by region/state/province"
            >
              <option value="">Any Region / Province</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              className="rounded-lg border p-2 text-sm"
              aria-label="Filter by city/town"
              disabled={!cities.length}
            >
              <option value="">{filters.region ? 'Any City / Town (in region)' : 'Any City / Town'}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Languages spoken (Premium) - do NOT show language list on free tier */}
            {isPremium ? (
              <details className="rounded-lg border bg-white p-2">
                <summary className="cursor-pointer text-sm text-slate-700 select-none">
                  Languages spoken{' '}
                  {filters.languages.length ? <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-900 text-white">{filters.languages.length}</span> : null}
                </summary>
                <div className="mt-2 max-h-44 overflow-auto pr-1 space-y-1">
                  {languagesAll.length ? (
                    languagesAll.map((lang) => (
                      <label key={lang} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={filters.languages.includes(lang)} onChange={() => toggleLanguage(lang)} />
                        <span className="text-slate-700">{lang}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No language data available.</div>
                  )}
                </div>
              </details>
            ) : (
              <button
                type="button"
                onClick={() => openUpgrade('Languages spoken')}
                className="rounded-lg border bg-white p-2 text-left hover:bg-slate-50"
                aria-label="Languages spoken (Premium)"
              >
                <div className="text-sm text-slate-700">Languages spoken</div>
                <div className="text-xs text-slate-500 mt-0.5">Premium feature</div>
              </button>
            )}

            {/* Minimum experience (Premium) */}
            <div
              className={`rounded-lg border bg-white p-2 ${!isPremium ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              onClick={() => {
                if (!isPremium) openUpgrade('Years of experience filter');
              }}
              role={!isPremium ? 'button' : undefined}
              tabIndex={!isPremium ? 0 : undefined}
              onKeyDown={(e) => {
                if (!isPremium) {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openUpgrade('Years of experience filter');
                  }
                }
              }}
            >
              <label className="text-sm text-slate-700 block">Minimum experience</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={filters.minYearsExp}
                  onChange={(e) => {
                    if (!isPremium) return openUpgrade('Years of experience filter');
                    setFilters((f) => ({ ...f, minYearsExp: +e.target.value }));
                  }}
                  className="w-full"
                  aria-label="Minimum years experience"
                  disabled={!isPremium}
                />
                <div className="text-sm font-medium text-slate-900 w-14 text-right">{filters.minYearsExp}+</div>
              </div>
              {!isPremium ? <div className="text-[11px] text-slate-500 mt-1">Premium feature</div> : null}
            </div>

            <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600 block">Max Price: {filters.price}</label>
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={100}
                  value={filters.price}
                  onChange={(e) => setFilters((f) => ({ ...f, price: +e.target.value }))}
                  className="w-full"
                  aria-label="Max price"
                />
              </div>

              <div className="flex flex-col gap-2 text-sm md:col-span-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={onlineOnly} onChange={toggleOnline} /> Online now
                  </label>

                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={showFavsOnly} onChange={() => setShowFavsOnly((f) => !f)} /> Favourites only
                  </label>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.previouslyConsulted === 'yes'}
                      onChange={() => {
                        if (!isPremium) return openUpgrade('Previously consulted filter');
                        setFilters((f) => ({ ...f, previouslyConsulted: f.previouslyConsulted === 'yes' ? '' : 'yes' }));
                      }}
                      disabled={!isPremium}
                    />
                    Previously consulted {!isPremium ? <span className="text-xs text-slate-500">(Premium)</span> : null}
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600">Medical Aid:</span>
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={filters.acceptsMedicalAid}
                    onChange={(e) => setFilters((f) => ({ ...f, acceptsMedicalAid: e.target.value as '' | 'yes' | 'no' }))}
                    aria-label="Filter by Medical Aid acceptance"
                  >
                    <option value="">Any</option>
                    <option value="yes">Accepts Medical Aid</option>
                    <option value="no">Private pay only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="col-span-full flex items-center gap-3">
              <button onClick={resetFilters} className="text-sm text-gray-600 underline" type="button">
                Reset filters
              </button>
            </div>
          </section>
        )}

        <div className="bg-white rounded-xl border divide-y overflow-hidden">
          {loading ? (
            <>
              <div className="p-6">
                <SkeletonRow />
              </div>
              <div className="p-6 border-t">
                <SkeletonRow />
              </div>
              <div className="p-6 border-t">
                <SkeletonRow />
              </div>
            </>
          ) : paginated.length === 0 ? (
            <div className="p-6 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">No clinicians match these filters</div>
              <p className="mt-1">Try clearing some filters or switching category to see more options.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={resetFilters} className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50">
                  Reset filters
                </button>
                <Link href="/auto-triage" className="px-3 py-1.5 rounded-full text-xs bg-emerald-600 text-white hover:bg-emerald-700">
                  Start a quick triage
                </Link>
                <Link href="/appointments" className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50">
                  View your appointments
                </Link>
              </div>
            </div>
          ) : (
            paginated.map((c) => {
              const status = (c.status ?? 'active') as string;
              const isDisabled = status === 'disabled' || status === 'archived';
              const isDisciplinary = status === 'disciplinary';
              const isPending = status === 'pending';

              // Premium-only fields: do not compute/display on free tier
              const speaks = isPremium && Array.isArray(c.speaks) ? c.speaks.filter(Boolean).slice(0, 3) : [];
              const exp = isPremium && typeof c.yearsExp === 'number' ? c.yearsExp : null;

              const priceStr = formatMoney(c.currency, c.priceCents, c.priceZAR);
              const locParts = locPartsById[c.id] ?? parseLocationParts(c.location);

              const encounters = isPremium ? (encounterCounts[c.id] ?? 0) : 0;

              const joinedAt = typeof c.joinedAt === 'number' ? c.joinedAt : null;
              const isNew = joinedAt != null ? Date.now() - joinedAt < NEW_CLINICIAN_WINDOW_MS : false;

              const meta = isPremium ? computeMeta(c) : null;
              const availabilityLabel = isPremium && meta?.nextAvailableAt ? formatAvailabilityLabel(meta.nextAvailableAt) : null;

              const pinned = isPremium ? compareIds.includes(c.id) : false;

              const resp = isPremium ? meta?.responseTimeMins : null;
              const respLabel = typeof resp === 'number' ? (resp < 60 ? `~${resp}m` : `~${Math.round(resp / 60)}h`) : '—';

              return (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                  <div className="flex gap-3 items-start min-w-0">
                    <div className="h-11 w-11 rounded-full bg-indigo-600 text-white grid place-items-center font-semibold shrink-0">
                      {initialsFromName(c.name)}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        <span className="text-slate-900 truncate">{c.name}</span>

                        {/* Previously Consulted (Premium) - do NOT show on free tier */}
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

                        {/* Next Availability (Premium) - do NOT show on free tier */}
                        {isPremium && availabilityLabel ? (
                          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-800">
                            Next slot: {availabilityLabel}
                          </span>
                        ) : null}

                        {isDisciplinary ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                            Under review
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm text-gray-600">
                        {c.specialty}
                        {locParts.city || locParts.region ? (
                          <>
                            {' '}
                            • {locParts.city}
                            {locParts.region ? <span className="text-gray-500">, {locParts.region}</span> : null}
                          </>
                        ) : (
                          <>
                            {' '}
                            • {c.location}
                          </>
                        )}
                      </div>

                      {c.practiceName ? <div className="text-xs text-gray-500 mt-0.5 truncate">{c.practiceName}</div> : null}

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                        {/* Languages spoken (Premium) - do NOT show on free tier */}
                        {isPremium && speaks.length > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                            Speaks: {speaks.join(' · ')}
                          </span>
                        ) : null}

                        {/* Years of experience (Premium) - do NOT show on free tier */}
                        {isPremium && exp != null ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                            {exp} yrs exp
                          </span>
                        ) : null}

                        {c.acceptsMedicalAid === true ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            Accepts Medical Aid / insurance
                          </span>
                        ) : c.acceptsMedicalAid === false ? (
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
                            Not accepting new bookings
                          </span>
                        ) : null}
                      </div>

                      <RatingRow rating={c.rating} count={c.ratingCount} />

                      {priceStr ? (
                        <div className="text-xs text-gray-700 mt-1">
                          From <b>{priceStr}</b> / consult
                        </div>
                      ) : null}

                      {/* Trust (Premium) - do NOT show on free tier */}
                      {isPremium && meta ? (
                        <div className="mt-2 text-[11px] text-slate-600">
                          <span className="inline-flex items-center rounded-lg border bg-slate-50 px-2 py-1">
                            Trust: <span className="ml-1">Avg consult</span> <b className="ml-1 text-slate-900">{meta.consultMins}m</b>
                            <span className="mx-2 text-slate-300">•</span>
                            <span>Follow-up</span> <b className="ml-1 text-slate-900">{meta.followupMins}m</b>
                            <span className="mx-2 text-slate-300">•</span>
                            <span>Response</span> <b className="ml-1 text-slate-900">{respLabel}</b>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-3 items-center shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        c.online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {c.online ? 'Online' : 'Offline'}
                    </span>

                    {/* Compare pin (Premium) - show Pin always, but free tier opens upgrade modal */}
                    <button
                      type="button"
                      onClick={() => toggleCompare(c)}
                      className={`text-xs px-2 py-1 rounded-lg border ${pinned ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50'}`}
                      aria-pressed={pinned}
                    >
                      {pinned ? 'Pinned' : 'Pin'}
                    </button>

                    <HeartButton fav={favs.includes(c.id)} onClick={() => toggleFav(c.id)} label={favs.includes(c.id) ? `Unfavorite ${c.name}` : `Favourite ${c.name}`} />

                    <Link href={`/clinicians/${c.id}`} className="text-xs underline text-gray-600">
                      View
                    </Link>

                    <button
                      onClick={() => {
                        if (isDisabled) return;
                        handleCalendarClick(c);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg ${
                        isDisabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                      type="button"
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                    >
                      {isDisabled ? 'Not bookable' : 'Book Televisit'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 mt-4">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allFiltered.length)} of {allFiltered.length}
          </div>

          <nav className="flex items-center gap-2" aria-label="Pagination">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 text-sm rounded bg-white border disabled:opacity-50"
              disabled={page <= 1}
              aria-disabled={page <= 1}
              type="button"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={i}
                  onClick={() => setPage(pageNum)}
                  className={`px-2 py-1 text-sm rounded ${page === pageNum ? 'bg-gray-900 text-white' : 'bg-white border'}`}
                  aria-current={page === pageNum ? 'page' : undefined}
                  type="button"
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 text-sm rounded bg-white border disabled:opacity-50"
              disabled={page >= totalPages}
              aria-disabled={page >= totalPages}
              type="button"
            >
              Next
            </button>
          </nav>
        </div>
      </div>

      {/* Compare bar (fixed) - Premium only */}
      {isPremium && compareIds.length ? (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-7xl px-6 pb-4">
            <div className="rounded-2xl border bg-white shadow-lg p-3 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{compareIds.length}</span> pinned for compare
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompareIds([]);
                    setCompareOpen(false);
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-slate-50"
                >
                  Clear
                </button>
                <button type="button" onClick={() => setCompareOpen(true)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                  Compare
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <CompareDrawer />
      <UpgradeModal />
    </main>
  );
}
