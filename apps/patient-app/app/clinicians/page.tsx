// apps/patient-app/app/clinicians/page.tsx
'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';
import cleanText from '@/lib/cleanText';

import { ClinicianCard } from '@/components/clinicians/ClinicianCard';
import { CliniciansCompareDrawer } from '@/components/clinicians/CliniciansCompareDrawer';
import { UpgradeRequiredModal } from '@/components/clinicians/UpgradeRequiredModal';
import CliniciansPagination from '@/components/clinicians/CliniciansPagination';
import DirectoryToolbar from '@/components/clinicians/DirectoryToolbar';
import DirectoryFiltersPanel from '@/components/clinicians/DirectoryFiltersPanel';

type CountryCode = 'ZA';

const COUNTRY_LABELS: Record<CountryCode, string> = {
  ZA: 'South Africa',
};


const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
type UIClass = (typeof UI_CLASSES)[number];

const PAGE_SIZE = 10;
const ENCOUNTER_KEY = 'clinician.encounters.v1';
const COMPARE_KEY = 'clinician.compare.v1';
const FAVOURITES_KEY = 'clinician.favourites.v1';

// ✅ ratings bump channels (non-SSE path)
const RATINGS_BC_NAME = 'ambulant_ratings';
const RATINGS_BUMP_STORAGE_KEY = 'ambulant.ratings.bump';

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

  // price from API
  priceZAR?: number;
  priceCents?: number;
  currency?: string;

  rating?: number;
  ratingCount?: number;
  online?: boolean;
  status?: 'active' | 'pending' | 'disabled' | 'disciplinary' | string;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  avatarDataUrl?: string | null;

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

const SURFACE =
  'relative overflow-hidden rounded-[28px] border border-white/55 bg-white/72 backdrop-blur-2xl shadow-[0_16px_60px_rgba(15,23,42,0.08)]';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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

function normalizeClinicianClassValue(
  raw: unknown,
  specialty?: unknown,
): 'Doctor' | 'Allied Health' | 'Wellness' {
  const s = String(raw ?? '').trim().toLowerCase();

  if (
    s === 'doctor' ||
    s === 'doctors' ||
    s === 'medical' ||
    s === 'clinical' ||
    s === 'general practice' ||
    s === 'general practitioner'
  ) {
    return 'Doctor';
  }

  if (s.includes('allied')) return 'Allied Health';
  if (s.includes('wellness')) return 'Wellness';

  const spec = String(specialty ?? '').trim().toLowerCase();
  if (spec.includes('wellness')) return 'Wellness';
  if (spec.includes('allied')) return 'Allied Health';

  return 'Doctor';
}

function formatMoney(currency?: string, cents?: number, fallbackZar?: number) {
  if (typeof cents === 'number' && currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  }

  if (typeof fallbackZar === 'number') {
    return `R${Number(fallbackZar).toFixed(0)}`;
  }

  return '';
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeParseMs(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}


function getUid() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ambulant_uid') || '';
}

async function readJsonSafe(r: Response) {
  return r.json().catch(() => null);
}

function authHeaders(): Record<string, string> {
  const uid = getUid();
  return uid ? { 'x-role': 'patient', 'x-uid': uid } : { 'x-role': 'patient' };
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map(String).map((x) => x.trim()).filter(Boolean)));
}

function readLocalFavouriteIds(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || '[]');
    return Array.isArray(parsed) ? uniqueIds(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalFavouriteIds(ids: string[]) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(uniqueIds(ids)));
  } catch {}
}

async function fetchFavouritesFromApi(): Promise<string[]> {
  const localIds = readLocalFavouriteIds();

  try {
    const r = await fetch('/api/favourites', {
      cache: 'no-store',
      headers: authHeaders(),
    });
    const j = await readJsonSafe(r);

    if (!r.ok) return localIds;

    const ids = Array.isArray(j?.ids)
      ? j.ids
      : Array.isArray(j?.favourites)
        ? j.favourites
        : [];

    const merged = uniqueIds([...localIds, ...ids.map((x: any) => String(x))]);
    writeLocalFavouriteIds(merged);
    return merged;
  } catch {
    return localIds;
  }
}

async function saveFavouriteToApi(id: string) {
  const r = await fetch('/api/favourites', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ id }),
  });
  if (!r.ok) {
    const j = await readJsonSafe(r);
    throw new Error(j?.error || 'Failed to save favourite');
  }
}

async function removeFavouriteFromApi(id: string) {
  const r = await fetch(`/api/favourites?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const j = await readJsonSafe(r);
    throw new Error(j?.error || 'Failed to remove favourite');
  }
}

function hasRealMeta(c: ClinicianItem) {
  return (
    typeof c.nextAvailableAt === 'number' ||
    typeof c.consultMins === 'number' ||
    typeof c.followupMins === 'number' ||
    typeof c.responseTimeMins === 'number'
  );
}

// Supports patterns like: "Cape Town, Western Cape", "Lagos - Ikeja", "Nairobi • Westlands"
function parseLocationParts(raw: string) {
  const s = cleanText(raw || '');
  if (!s) return { city: '', region: '' };

  const byComma = s.split(',').map((x) => x.trim()).filter(Boolean);
  if (byComma.length >= 2) return { city: byComma[0], region: byComma.slice(1).join(', ') };

  const byDot = s.split('•').map((x) => x.trim()).filter(Boolean);
  if (byDot.length >= 2) return { city: byDot[0], region: byDot.slice(1).join(' • ') };

  const byDash = s.split(' - ').map((x) => x.trim()).filter(Boolean);
  if (byDash.length >= 2) return { city: byDash[0], region: byDash.slice(1).join(' - ') };

  return { city: s, region: '' };
}

function normalizeStatus(s?: string) {
  return String(s ?? 'active').trim().toLowerCase();
}

function clinicianBookable(c: ClinicianItem) {
  if (!c.operational) return normalizeStatus(c.status) === 'active';
  return !!c.operational.canBeBooked;
}

function buildPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  pages.add(current);

  for (let d = 1; d <= 1; d++) {
    if (current - d >= 1) pages.add(current - d);
    if (current + d <= total) pages.add(current + d);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && p - prev > 1) out.push('…');
    out.push(p);
  }
  return out;
}

/* ---------------------------
   Availability + trust metadata
   Production path: render only backend-supplied fields.
--------------------------- */


function stableIdFromFields(parts: Array<string | number | undefined | null>) {
  const raw = parts
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('|');

  if (!raw) return '';

  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return `c_${(h >>> 0).toString(36)}`;
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
  const nextAvailableAt = typeof c.nextAvailableAt === 'number' ? c.nextAvailableAt : null;
  const consultMins = typeof c.consultMins === 'number' ? c.consultMins : null;
  const followupMins = typeof c.followupMins === 'number' ? c.followupMins : null;
  const responseTimeMins = typeof c.responseTimeMins === 'number' ? c.responseTimeMins : null;

  return {
    nextAvailableAt,
    consultMins,
    followupMins,
    responseTimeMins,
    isSynthetic: false,
    hasReal: hasRealMeta(c),
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
    const n = normalizeStatus(s);
    if (!n || n === 'active' || n === 'pending') return 0;
    if (n === 'disciplinary') return 1;
    if (n === 'disabled' || n === 'archived') return 2;
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
  return v.trim().toUpperCase() === 'ZA' ? 'ZA' : null;
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
    id: String(
      c.id ??
        c.slug ??
        stableIdFromFields([
          c.name,
          c.specialty,
          c.location,
          c.practiceName ?? c.practice ?? '',
          c.country ?? '',
          c.profile?.hpcsaNumber ?? '',
        ]),
    ),
    name: cleanText(c.name ?? ''),
    specialty: cleanText(c.specialty ?? ''),
    location: cleanText(c.location ?? ''),
    rating: Number.isFinite(rating) ? rating : 0,
    ratingCount,
    online: Boolean(c.online),

    cls: normalizeClinicianClassValue(
      c.cls ??
        c['class'] ??
        c.className ??
        c.category ??
        c.patientCategory ??
        c.operational?.patientCategory,
      c.specialty,
    ),

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
    yearsExp:
      typeof c.yearsExp === 'number'
        ? c.yearsExp
        : typeof c.yearsExperience === 'number'
        ? c.yearsExperience
        : undefined,

    joinedAt,

    // optional future backend fields:
    nextAvailableAt: safeParseMs(c.nextAvailableAt) ?? safeParseMs(c.nextSlotAt) ?? null,
    consultMins:
      typeof c.consultMins === 'number' ? c.consultMins : typeof c.avgConsultMins === 'number' ? c.avgConsultMins : null,
    followupMins:
      typeof c.followupMins === 'number' ? c.followupMins : typeof c.followUpMins === 'number' ? c.followUpMins : null,
    responseTimeMins:
      typeof c.responseTimeMins === 'number' ? c.responseTimeMins : typeof c.avgResponseMins === 'number' ? c.avgResponseMins : null,

    operational:
      c.operational && typeof c.operational === 'object'
        ? {
            canBeListed: !!c.operational.canBeListed,
            canBeBooked: !!c.operational.canBeBooked,
            canPrescribe: !!c.operational.canPrescribe,
            prescribingMode: c.operational.prescribingMode ?? 'no',
            allowedWorkspaces: Array.isArray(c.operational.allowedWorkspaces)
              ? c.operational.allowedWorkspaces.map(String)
              : [],
            patientCategory: c.operational.patientCategory ?? null,
            blockers: Array.isArray(c.operational.blockers) ? c.operational.blockers.map(String) : [],
            riskFlags: Array.isArray(c.operational.riskFlags) ? c.operational.riskFlags.map(String) : [],
            ambulantId: c.operational.ambulantId ?? null,
          }
        : undefined,
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

/* ---------------------------
   Page component
--------------------------- */
function CliniciansPageContent() {
  const router = useRouter();
  const { isPremium } = usePlan();
  const sp = useSearchParams();
  const qs = useMemo(
    () => new URLSearchParams(sp?.toString() ?? ''),
    [sp],
  );

  const bootstrappedRef = useRef(false);

  const [country, setCountry] = useState<CountryCode>(normalizeCountryParam(qs.get('country')) ?? 'ZA');
  const handleCountryChange = useCallback((value: CountryCode) => {
    setCountry(value === 'ZA' ? 'ZA' : 'ZA');
  }, []);

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

    const get = (k: string) => qs.get(k) ?? '';
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
  }, [qs]);

  // URL sync (deep-link browsing state)
  useEffect(() => {
    const current = qs.toString();
    const next = new URLSearchParams(current);

    if (country && country !== 'ZA') next.set('country', country);
    else next.delete('country');

    const tabClass = tab === 'Doctors' ? 'doctor' : tab.toLowerCase();
    next.set('class', tabClass);

    if (debouncedQ) next.set('q', debouncedQ);
    else next.delete('q');

    if (filters.gender) next.set('gender', filters.gender);
    else next.delete('gender');

    if (filters.specialty) next.set('specialties', filters.specialty);
    else next.delete('specialties');

    if (onlineOnly) next.set('online', '1');
    else next.delete('online');

    const target = next.toString();

    if (target !== current) {
      router.replace(`/clinicians${target ? `?${target}` : ''}`, { scroll: false });
    }
  }, [country, tab, debouncedQ, filters.gender, filters.specialty, onlineOnly, router, qs]);

  // sticky shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // load favourites from server-backed patient API
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ids = await fetchFavouritesFromApi();
      if (!cancelled) setFavs(ids);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [isPremium]);

  const toggleFav = useCallback(async (id: string) => {
    const currentlyFav = favs.includes(id);
    const nextFavs = currentlyFav ? favs.filter((f) => f !== id) : uniqueIds([...favs, id]);

    setFavs(nextFavs);
    writeLocalFavouriteIds(nextFavs);

    try {
      if (currentlyFav) {
        await removeFavouriteFromApi(id);
      } else {
        await saveFavouriteToApi(id);
      }
    } catch (e: any) {
      const reverted = currentlyFav ? uniqueIds([...favs, id]) : favs.filter((f) => f !== id);
      setFavs(reverted);
      writeLocalFavouriteIds(reverted);
      toast(e?.message || 'Failed to update favourites', 'error');
    }
  }, [favs]);

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

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('perPage', '500');
    params.set('country', country);
    params.set('class', tab === 'Doctors' ? 'doctor' : tab.toLowerCase());
    return `/api/clinicians?${params.toString()}`;
  }, [country, tab]);

  const { data, error, isValidating } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [allClinicians, setAllClinicians] = useState<ClinicianItem[]>([]);

  useEffect(() => {
    if (data) {
      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.clinicians)
          ? data.clinicians
          : Array.isArray(data?.items)
            ? data.items
            : [];

      const mapped = list.map(mapApiToItem).filter((c) => c?.operational?.canBeListed !== false);
      setAllClinicians(mapped);
      setPage(1);
      return;
    }

    if (error) {
      setAllClinicians([]);
      setPage(1);
      try {
        toast('Unable to load live clinician directory right now.', 'error');
      } catch {}
    }
  }, [data, error]);

  const loading = isValidating && !data && !allClinicians.length;

  // Listen to server-sent events for presence and booking updates (ZA API mode)
  useEffect(() => {
    if (!apiUrl) return;

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
            apiUrl,
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

                if (payload.lastBookedAt)
                  updated.lastBookedAt =
                    typeof payload.lastBookedAt === 'number'
                      ? payload.lastBookedAt
                      : Date.parse(payload.lastBookedAt);
                if (payload.lastSeenAt)
                  updated.lastSeenAt =
                    typeof payload.lastSeenAt === 'number' ? payload.lastSeenAt : Date.parse(payload.lastSeenAt);
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
                if (typeof payload.responseTimeMins !== 'undefined') updated.responseTimeMins = payload.responseTimeMins;

                updated.name = cleanText(updated.name ?? '');
                updated.specialty = cleanText(updated.specialty ?? '');
                updated.location = cleanText(updated.location ?? '');
                return updated;
              });

              const found = mapped.some((c) => String(c.id) === String(payload.clinicianId));
              if (!found && payload.full) {
                mapped.push(mapApiToItem(payload.full));
              }

              if (Array.isArray(current)) {
                return mapped;
              }

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
  }, [apiUrl]);

  /* ---------------------------
     ✅ Ratings bumps (non-SSE)
     - BroadcastChannel: ambulant_ratings (same tab + other tabs)
     - storage key: ambulant.ratings.bump (other tabs)
     - patches SWR cache if possible; otherwise revalidates
  --------------------------- */
  useEffect(() => {
    if (!apiUrl) return;

    let bc: BroadcastChannel | null = null;
    let lastRevalidateAt = 0;
    let revalidateTimer: any = null;

    const toNum = (v: any): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    const scheduleRevalidate = () => {
      const now = Date.now();
      const gap = now - lastRevalidateAt;

      // simple throttle so we don't refetch in a tight loop
      if (gap < 800) {
        if (revalidateTimer) clearTimeout(revalidateTimer);
        revalidateTimer = setTimeout(() => {
          lastRevalidateAt = Date.now();
          globalMutate(apiUrl);
        }, 900);
        return;
      }

      lastRevalidateAt = now;
      globalMutate(apiUrl);
    };

    const tryPatch = (p: any) => {
      const clinicianId = String(p?.clinicianId ?? p?.clinician_id ?? p?.id ?? p?.clinician ?? '').trim();
      if (!clinicianId) return false;

      const count =
        toNum(p?.ratingCount) ??
        toNum(p?.ratingsCount) ??
        toNum(p?.reviewCount) ??
        toNum(p?.totalRatings) ??
        toNum(p?.count);

      const avg =
        toNum(p?.ratingAvg) ??
        toNum(p?.ratingAverage) ??
        toNum(p?.ratingMean) ??
        toNum(p?.rating);

      const sum = toNum(p?.ratingSum);

      const nextRating =
        avg != null
          ? clamp(avg, 0, 5)
          : sum != null && count != null && count > 0
          ? clamp(sum / count, 0, 5)
          : null;

      const hasAny = nextRating != null || count != null;
      if (!hasAny) return false;

      // Patch SWR cache (fast UI update, no refetch)
      globalMutate(
        apiUrl,
        (current: any) => {
          const arr: any[] = Array.isArray(current)
            ? current
            : Array.isArray(current?.clinicians)
            ? current.clinicians
            : Array.isArray(current?.items)
            ? current.items
            : [];

          let touched = false;

          const patched = arr.map((c) => {
            if (String(c?.id) !== clinicianId) return c;
            touched = true;
            const updated: any = { ...c };

            if (nextRating != null) updated.rating = nextRating;
            if (count != null) updated.ratingCount = count;

            // tolerate payload variants that ship sums too
            if (typeof p?.ratingSum !== 'undefined') updated.ratingSum = p.ratingSum;

            // keep text fields clean
            updated.name = cleanText(updated.name ?? '');
            updated.specialty = cleanText(updated.specialty ?? '');
            updated.location = cleanText(updated.location ?? '');
            return updated;
          });

          // If not found, bail (caller will revalidate)
          if (!touched) return current;

          if (Array.isArray(current)) return patched;
          return { ...(current ?? {}), clinicians: patched, items: patched };
        },
        false,
      );

      // Also patch local rendered list immediately (this page renders from allClinicians state)
      setAllClinicians((prev) =>
        prev.map((c) => {
          if (String(c.id) !== clinicianId) return c;
          const updated: ClinicianItem = { ...c };
          if (nextRating != null) updated.rating = nextRating;
          if (count != null) updated.ratingCount = count;
          return updated;
        }),
      );

      return true;
    };

    const handleRaw = (raw: any) => {
      try {
        let payload: any = raw;

        if (typeof raw === 'string') {
          const s = raw.trim();
          if (!s) return scheduleRevalidate();
          try {
            payload = JSON.parse(s);
          } catch {
            // tolerate simple bumps like "clinicianId"
            payload = { clinicianId: s };
          }
        }

        if (!payload || typeof payload !== 'object') return scheduleRevalidate();

        const ok = tryPatch(payload);
        if (!ok) scheduleRevalidate();
      } catch {
        scheduleRevalidate();
      }
    };

    // BroadcastChannel: same tab + other tabs
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(RATINGS_BC_NAME);
        bc.onmessage = (ev: MessageEvent) => handleRaw(ev.data);
      }
    } catch {
      bc = null;
    }

    // Storage bump: other tabs only (same-tab storage writes do not fire storage event)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RATINGS_BUMP_STORAGE_KEY) return;
      if (!e.newValue) return;
      handleRaw(e.newValue);
    };

    window.addEventListener('storage', onStorage);

    return () => {
      try {
        bc?.close();
      } catch {}
      window.removeEventListener('storage', onStorage);
      if (revalidateTimer) clearTimeout(revalidateTimer);
    };
  }, [apiUrl]);

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

    setEncounterCounts((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(ENCOUNTER_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, [encounterData]);

  // compute scoped clinicians (class filter)
  const scoped = useMemo(
    () =>
      allClinicians.filter((c) => {
        const clsMatch = (c.cls ?? c?.cls) === toDataClass(tab) || (c.cls == null && toDataClass(tab) === 'Doctor');
        const status = normalizeStatus(c.status ?? 'active');
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

    setFilters((prev) => {
      const next = {
        ...prev,
        specialty: validSpecialties.has(prev.specialty) ? prev.specialty : '',
        gender: validGenders.has(prev.gender) ? prev.gender : '',
        region: validRegions.has(prev.region) ? prev.region : '',
        city: prev.city && validCities.has(prev.city) ? prev.city : '',
      };

      const same =
        next.specialty === prev.specialty &&
        next.gender === prev.gender &&
        next.region === prev.region &&
        next.city === prev.city;

      return same ? prev : next;
    });

    setPage(1);
  }, [scoped, locPartsById, filters.region]);

  const toggleOnline = useCallback(() => {
    if (!isPremium) return toast('Online-now filter is a Premium feature', 'error');
    setOnlineOnly((v) => !v);
    setPage(1);
  }, [isPremium]);

  useEffect(() => {
    setPage(1);
  }, [
    country,
    tab,
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

    if (L.length) {
      L = L.filter((c) => {
        if (!clinicianBookable(c)) return false;
        return true;
      });
    }

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
        const ta = typeof a.nextAvailableAt === 'number' ? a.nextAvailableAt : Number.POSITIVE_INFINITY;
        const tb = typeof b.nextAvailableAt === 'number' ? b.nextAvailableAt : Number.POSITIVE_INFINITY;

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
  const pageButtons = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);

  const specialties = useMemo(
    () => Array.from(new Set(scoped.map((c) => c.specialty))).filter(Boolean) as string[],
    [scoped],
  );
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
    if (filters.acceptsMedicalAid === 'yes')
      chips.push({ label: 'Accepts Medical Aid', onRemove: () => removeChip('acceptsMedicalAid') });
    if (filters.acceptsMedicalAid === 'no')
      chips.push({ label: 'Private pay only', onRemove: () => removeChip('acceptsMedicalAid') });

    if (isPremium) {
      if (filters.previouslyConsulted === 'yes')
        chips.push({ label: 'Previously consulted', onRemove: () => removeChip('previouslyConsulted') });
      if (filters.minYearsExp > 0)
        chips.push({ label: `≥ ${filters.minYearsExp} yrs exp`, onRemove: () => removeChip('minYearsExp') });
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

  const HeartButton: React.FC<{ fav: boolean; onClick: () => void; label: string }> = ({ fav, onClick, label }) => {
    const gradientId = useId();

    return (
      <button
        onClick={onClick}
        aria-pressed={fav}
        aria-label={label}
        className="relative p-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
        type="button"
      >
        <span className={`heart ${fav ? 'liked' : 'unliked'}`} aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff8da1" />
                <stop offset="100%" stopColor="#ff3b6f" />
              </linearGradient>
            </defs>

            <path
              className="heart-fill"
              d="M12 21s-7.5-4.9-9.2-7C1.5 11 4 7 7.5 7 9.2 7 10 8 12 9.5 14 8 14.8 7 16.5 7 20 7 22.5 11 21.2 14c-1.7 2.1-9.2 7-9.2 7z"
              fill={`url(#${gradientId})`}
              opacity={fav ? 1 : 0}
              style={{ transition: 'opacity .18s linear, transform .22s cubic-bezier(.2,.9,.3,1)' }}
            />
            <path
              className="heart-outline"
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
  };

  const handleCalendarClick = useCallback(
    (c: ClinicianItem) => {
      const status = normalizeStatus(c.status ?? 'active');
      if (status === 'disabled' || status === 'archived') {
        toast('This clinician is not accepting new bookings via Ambulant+ at the moment.', 'info');
        return;
      }

      if (!clinicianBookable(c)) {
        toast('This clinician is not currently available for booking.', 'info');
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

  return (
    <main data-p-ui="patient-clinicians-page"
      className={cn(
        'relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.12),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_42%,_#f8faff_100%)]',
        isPremium && compareIds.length ? 'pb-24' : 'pb-10',
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-[-12%] top-[-8%] h-[420px] w-[420px] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[360px] w-[360px] rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[18%] h-[300px] w-[300px] rounded-full bg-indigo-300/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <DirectoryToolbar
          country={country}
          setCountry={handleCountryChange}
          tab={tab}
          setTab={setTab}
          filters={filters}
          setFilters={setFilters}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          activeFilterCount={activeFilterCount}
          resetFilters={resetFilters}
          setSortSafe={setSortSafe}
          activeChips={activeChips}
          scrolled={scrolled}
        />

        <div className="px-6 py-4 space-y-4">
          {/* Quick count */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{allFiltered.length.toLocaleString()}</span> clinicians found
            </div>

            {isPremium && compareIds.length ? (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50"
              >
                Compare ({compareIds.length})
              </button>
            ) : null}
          </div>

          <DirectoryFiltersPanel
            show={showFilters}
            isPremium={isPremium}
            filters={filters}
            specialties={specialties}
            genders={genders}
            regions={regions}
            cities={cities}
            languagesAll={languagesAll}
            setFilters={setFilters}
            setSortSafe={setSortSafe}
            toggleLanguage={toggleLanguage}
            toggleOnline={toggleOnline}
            onlineOnly={onlineOnly}
            showFavsOnly={showFavsOnly}
            setShowFavsOnly={setShowFavsOnly}
            openUpgrade={openUpgrade}
            resetFilters={resetFilters}
          />

          <div className={cn(SURFACE, 'divide-y overflow-hidden')}>
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
                const status = normalizeStatus(c.status ?? 'active');
                const isDisabled =
                  !clinicianBookable(c) ||
                  normalizeStatus(c.status) === 'disabled' ||
                  normalizeStatus(c.status) === 'archived';
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

                const showAvailability =
                  isPremium && !!meta?.nextAvailableAt && !!meta?.hasReal;

                const availabilityLabel =
                  showAvailability && meta?.nextAvailableAt
                    ? formatAvailabilityLabel(meta.nextAvailableAt)
                    : null;

                const pinned = isPremium ? compareIds.includes(c.id) : false;

                const showTrustBlock =
                  isPremium &&
                  !!meta &&
                  meta.hasReal &&
                  typeof meta.consultMins === 'number' &&
                  typeof meta.followupMins === 'number' &&
                  typeof meta.responseTimeMins === 'number';

                const resp = showTrustBlock ? meta?.responseTimeMins : null;
                const respLabel =
                  typeof resp === 'number'
                    ? (resp < 60 ? `~${resp}m` : `~${Math.round(resp / 60)}h`)
                    : '—';

                return (
                  <ClinicianCard
                    key={c.id}
                    clinician={c}
                    isPremium={isPremium}
                    isFav={favs.includes(c.id)}
                    pinned={pinned}
                    encounters={encounters}
                    isNew={isNew}
                    isDisabled={isDisabled}
                    isDisciplinary={isDisciplinary}
                    isPending={isPending}
                    availabilityLabel={availabilityLabel}
                    showTrustBlock={showTrustBlock}
                    trustLabel={
                      <span className="inline-flex items-center rounded-lg border bg-slate-50 px-2 py-1">
                        Trust: <span className="ml-1">Avg consult</span>{' '}
                        <b className="ml-1 text-slate-900">{meta?.consultMins}m</b>
                        <span className="mx-2 text-slate-300">•</span>
                        <span>Follow-up</span>{' '}
                        <b className="ml-1 text-slate-900">{meta?.followupMins}m</b>
                        <span className="mx-2 text-slate-300">•</span>
                        <span>Response</span> <b className="ml-1 text-slate-900">{respLabel}</b>
                      </span>
                    }
                    speaks={speaks}
                    exp={exp}
                    demoMode={false}
                    isSyntheticMeta={!!meta?.isSynthetic}
                    priceLabel={priceStr}
                    locationNode={
                      <>
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
                      </>
                    }
                    ratingNode={<RatingRow rating={c.rating} count={c.ratingCount} />}
                    favouriteControl={
                      <HeartButton
                        fav={favs.includes(c.id)}
                        onClick={() => toggleFav(c.id)}
                        label={favs.includes(c.id) ? `Unfavorite ${c.name}` : `Favourite ${c.name}`}
                      />
                    }
                    onToggleCompare={() => toggleCompare(c)}
                    onBook={() => {
                      if (isDisabled) return;
                      handleCalendarClick(c);
                    }}
                  />
                );
              })
            )}
          </div>

          <CliniciansPagination
            page={page}
            totalPages={totalPages}
            totalItems={allFiltered.length}
            pageSize={PAGE_SIZE}
            pageButtons={pageButtons}
            onPageChange={setPage}
          />
        </div>

        {/* Compare bar (fixed) - Premium only */}
        {isPremium && compareIds.length ? (
          <div className="fixed inset-x-0 bottom-0 z-40">
            <div className="mx-auto max-w-7xl px-6 pb-4">
              <div className="rounded-[24px] border border-white/60 bg-white/82 backdrop-blur-2xl shadow-[0_18px_40px_rgba(15,23,42,0.10)] p-3.5 flex items-center justify-between gap-3">
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
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    className="px-3.5 py-1.5 text-sm rounded-full bg-slate-950 text-white hover:bg-slate-800 shadow-sm"
                  >
                    Compare
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <CliniciansCompareDrawer
          open={compareOpen}
          isPremium={isPremium}
          clinicians={compareClinicians}
          demoMode={false}
          getMeta={computeMeta}
          formatMoney={formatMoney}
          formatAvailabilityLabel={formatAvailabilityLabel}
          onClose={() => setCompareOpen(false)}
          onToggleCompare={toggleCompare}
          onBook={handleCalendarClick}
        />
        <UpgradeRequiredModal
          open={upgradeModalOpen}
          reason={upgradeReason}
          clinician={modalClinician}
          onClose={() => setUpgradeModalOpen(false)}
          onUpgrade={() => router.push('/pricing')}
        />
      </div>
    </main>
  );
}

export default function CliniciansPage() {
  return (
    <Suspense fallback={null}>
      <CliniciansPageContent />
    </Suspense>
  );
}

