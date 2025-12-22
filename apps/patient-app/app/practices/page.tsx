// apps/patient-app/app/practices/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';
import cleanText from '@/lib/cleanText';

import * as PracticesMock from '@/mock/practices';

import { COUNTRY_LABELS } from '@/mock/clinicians-by-country';
import type { CountryCode } from '@/mock/clinicians-shared';

const MAIN_TABS = ['All', 'Teams', 'Clinics', 'Hospitals'] as const;
type MainTab = (typeof MAIN_TABS)[number];

const PAGE_SIZE = 10;
const FAV_KEY = 'practice.favs';

type PracticeKind = 'team' | 'clinic' | 'hospital' | 'other';

type PracticeItem = {
  id: string;
  name: string;
  kind: PracticeKind;
  subType?: string;
  location: string;
  locations?: string[];
  rating?: number;
  ratingCount?: number;
  priceFromZAR?: number;
  acceptsMedicalAid?: boolean;
  acceptedSchemes?: string[];
  logoUrl?: string;

  hasEncounter?: boolean;
  lastEncounterAt?: number | null;
  encounterCount?: number;

  premiumTier?: 'free' | 'basic' | 'pro' | 'host' | string;
  status?: 'active' | 'disabled' | 'archived' | string;
};

const HOVER_MENUS: Record<MainTab, string[]> = {
  All: ['Teams', 'Clinics', 'Hospitals'],
  Teams: ['Virtual teams', 'Multi-site practices'],
  Clinics: ['Small clinic', 'Specialist clinic'],
  Hospitals: ['Specialist hospital', 'Multi-specialty hospital'],
};

function normalizeKind(raw: any): PracticeKind {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s.includes('team')) return 'team';
  if (s.includes('clinic')) return 'clinic';
  if (s.includes('hospital')) return 'hospital';
  return 'other';
}

function tabToKind(tab: MainTab): PracticeKind | null {
  switch (tab) {
    case 'Teams':
      return 'team';
    case 'Clinics':
      return 'clinic';
    case 'Hospitals':
      return 'hospital';
    default:
      return null;
  }
}

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

function formatZar(n?: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return `R${n.toFixed(0)}`;
}

function normalizeCountryParam(v: string | null): CountryCode | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  if ((COUNTRY_LABELS as any)[s]) return s as CountryCode;
  return null;
}

/**
 * ✅ Matches YOUR mock exports:
 * - PRACTICES_ZA, PRACTICES_NG, PRACTICES_KE, ...
 * - plus back-compat PRACTICES (ZA)
 * Also tolerates other optional shapes if added later.
 */
function getFallbackPracticesForCountry(country: CountryCode): any[] {
  // 1) Your actual pattern: PRACTICES_${country}
  const direct = (PracticesMock as any)[`PRACTICES_${country}`];
  if (Array.isArray(direct) && direct.length) return direct;

  // 2) Optional helpers if introduced later
  const maybeFn =
    (PracticesMock as any).getMockPracticesForCountry ??
    (PracticesMock as any).default?.getMockPracticesForCountry;
  if (typeof maybeFn === 'function') {
    try {
      const res = maybeFn(country);
      if (Array.isArray(res) && res.length) return res;
    } catch {
      // ignore and fall through
    }
  }

  // 3) Optional map export if introduced later
  const byCountry =
    (PracticesMock as any).PRACTICES_BY_COUNTRY ??
    (PracticesMock as any).default?.PRACTICES_BY_COUNTRY ??
    null;
  if (byCountry && typeof byCountry === 'object') {
    const list = (byCountry as any)[country];
    if (Array.isArray(list) && list.length) return list;
  }

  // 4) Back-compat: PRACTICES (ZA)
  const base = (PracticesMock as any).PRACTICES ?? (PracticesMock as any).default?.PRACTICES ?? null;
  if (Array.isArray(base) && base.length) return base;

  // 5) Last resort: find any exported array with content
  for (const v of Object.values(PracticesMock as any)) {
    if (Array.isArray(v) && v.length) return v;
  }

  return [];
}

export default function PracticesPage() {
  const sp = useSearchParams();
  const { isPremium } = usePlan();

  const [country, setCountry] = useState<CountryCode>(
    normalizeCountryParam(sp.get('country')) ?? 'ZA',
  );

  const [tab, setTab] = useState<MainTab>('All');
  const [page, setPage] = useState(1);
  const [favs, setFavs] = useState<string[]>([]);
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  const [filters, setFilters] = useState<{
    q: string;
    location: string;
    sort: 'rating-desc' | 'name' | 'price';
    price: number;
    acceptsMedicalAid: '' | 'yes' | 'no';
    visitedOnly: boolean;
    premiumOnly: boolean;
  }>({
    q: '',
    location: '',
    sort: 'rating-desc',
    price: 5000,
    acceptsMedicalAid: '',
    visitedOnly: false,
    premiumOnly: false,
  });

  const [showFilters, setShowFilters] = useState(false);

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

  const toggleFav = useCallback(
    (id: string) =>
      setFavs((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      ),
    [],
  );

  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 250);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    const fromUrl = (sp.get('type') || '').toLowerCase().trim();
    if (fromUrl) {
      if (fromUrl.includes('team')) setTab('Teams');
      else if (fromUrl.includes('clinic')) setTab('Clinics');
      else if (fromUrl.includes('hospital')) setTab('Hospitals');
    }
    const loc = sp.get('location');
    const q = sp.get('q');
    const ctry = normalizeCountryParam(sp.get('country'));
    if (ctry) setCountry(ctry);

    setFilters((prev) => ({
      ...prev,
      location: loc || prev.location,
      q: q || prev.q,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const practicesUrl = useMemo(
    () => `/api/practices?country=${encodeURIComponent(country)}`,
    [country],
  );

  const { data, error, isValidating } = useSWR(practicesUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [allPractices, setAllPractices] = useState<PracticeItem[]>([]);

  useEffect(() => {
    const normaliseList = (list: any[]): PracticeItem[] =>
      list.map((p) => {
        const id = String(p.id ?? p.slug ?? p.practiceId ?? `${p.name}-${Math.random()}`);
        const name = cleanText(p.name ?? p.displayName ?? 'Practice');

        const mainLocation =
          p.primaryLocationName ??
          p.city ??
          p.town ??
          p.location ??
          (Array.isArray(p.locations) && p.locations[0]?.city) ??
          '';

        let priceFromZAR: number | undefined;
        if (typeof p.priceFromZAR === 'number') priceFromZAR = p.priceFromZAR;
        else if (typeof p.minConsultPriceZar === 'number') priceFromZAR = p.minConsultPriceZar;
        else if (typeof p.minPriceCents === 'number') priceFromZAR = Math.round(p.minPriceCents / 100);
        else if (typeof p.feeCents === 'number') priceFromZAR = Math.round(p.feeCents / 100);

        const encCount =
          (p as any).encounterCount ??
          (p as any).encountersCount ??
          (p as any).visitsCount ??
          (p as any).consultationsCount ??
          0;

        const hasEncounter =
          Boolean((p as any).hasEncounter) ||
          (typeof encCount === 'number' && encCount > 0);

        const lastRaw =
          (p as any).lastEncounterAt ??
          (p as any).lastVisitAt ??
          (p as any).lastConsultAt ??
          null;

        let lastEncounterAt: number | null = null;
        if (typeof lastRaw === 'number') lastEncounterAt = lastRaw;
        else if (lastRaw) {
          const parsed = Date.parse(String(lastRaw));
          if (!Number.isNaN(parsed)) lastEncounterAt = parsed;
        }

        const premiumTier: PracticeItem['premiumTier'] =
          (p as any).planTier ??
          (p as any).plan_tier ??
          (p as any).tier ??
          null;

        const acceptedSchemes: string[] = Array.isArray((p as any).acceptedSchemes)
          ? (p as any).acceptedSchemes
          : Array.isArray((p as any).acceptedSchemes)
            ? (p as any).acceptedSchemes
            : [];

        return {
          id,
          name,
          kind: normalizeKind((p as any).kind ?? (p as any).class ?? (p as any).practiceClass ?? (p as any).type),
          subType: (p as any).subType ?? (p as any).segment ?? (p as any).practiceType ?? undefined,
          location: cleanText(mainLocation),
          locations: Array.isArray(p.locations)
            ? p.locations
                .map((loc: any) => cleanText(loc.city ?? loc.label ?? loc.name ?? ''))
                .filter(Boolean)
            : undefined,
          rating: typeof p.rating === 'number' ? p.rating : typeof (p as any).avgRating === 'number' ? (p as any).avgRating : undefined,
          ratingCount:
            typeof (p as any).ratingCount === 'number'
              ? (p as any).ratingCount
              : typeof (p as any).ratingsCount === 'number'
                ? (p as any).ratingsCount
                : undefined,
          priceFromZAR,
          acceptsMedicalAid: typeof (p as any).acceptsMedicalAid === 'boolean' ? (p as any).acceptsMedicalAid : !!(p as any).medicalAidAccepted,
          acceptedSchemes,
          logoUrl: (p as any).logoUrl ?? (p as any).logo ?? undefined,
          hasEncounter,
          lastEncounterAt,
          encounterCount: typeof encCount === 'number' ? encCount : undefined,
          premiumTier,
          status: (p as any).status ?? (p as any).practiceStatus ?? (p as any).state ?? 'active',
        } as PracticeItem;
      });

    const fallback = getFallbackPracticesForCountry(country);

    if (data) {
      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.practices)
          ? (data as any).practices
          : [];

      if (list.length > 0) {
        setAllPractices(normaliseList(list));
        return;
      }

      setAllPractices(normaliseList(fallback));
      return;
    }

    if (error) {
      console.warn('Failed to load practices', error);
      try {
        toast('Unable to load practices right now. Showing example practices instead.', 'error');
      } catch {}
      setAllPractices(normaliseList(fallback));
      return;
    }

    setAllPractices(normaliseList(fallback));
  }, [data, error, country]);

  const loading = isValidating && !data && !allPractices.length;

  const locations = useMemo(
    () => Array.from(new Set(allPractices.map((p) => p.location).filter(Boolean))),
    [allPractices],
  );

  useEffect(() => {
    setPage(1);
  }, [
    country,
    debouncedQ,
    filters.location,
    filters.sort,
    filters.price,
    filters.acceptsMedicalAid,
    filters.visitedOnly,
    filters.premiumOnly,
    showFavsOnly,
    tab,
  ]);

  const scoped = useMemo(() => {
    const kind = tabToKind(tab);
    return allPractices.filter((p) => {
      const visible = (p.status ?? 'active') !== 'archived';
      if (!visible) return false;
      if (!kind) return true;
      return p.kind === kind;
    });
  }, [allPractices, tab]);

  const allFiltered = useMemo(() => {
    let L = scoped.slice();
    const q = debouncedQ.toLowerCase();

    if (q) {
      L = L.filter((p) => {
        const inName = (p.name || '').toLowerCase().includes(q);
        const inLoc = (p.location || '').toLowerCase().includes(q);
        const inSubtype = (p.subType || '').toLowerCase().includes(q);
        return inName || inLoc || inSubtype;
      });
    }

    if (filters.location) L = L.filter((p) => p.location === filters.location);
    if (filters.price) L = L.filter((p) => (p.priceFromZAR ?? Infinity) <= filters.price);
    if (filters.acceptsMedicalAid === 'yes') L = L.filter((p) => p.acceptsMedicalAid);
    if (filters.acceptsMedicalAid === 'no') L = L.filter((p) => p.acceptsMedicalAid === false);
    if (filters.visitedOnly) L = L.filter((p) => p.hasEncounter);
    if (showFavsOnly) L = L.filter((p) => favs.includes(p.id));
    if (filters.premiumOnly) L = L.filter((p) => p.premiumTier === 'pro' || p.premiumTier === 'host');

    L.sort((a, b) => {
      switch (filters.sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return (a.priceFromZAR ?? Infinity) - (b.priceFromZAR ?? Infinity);
        default: {
          const rA = a.rating ?? 0;
          const rB = b.rating ?? 0;
          if (rA !== rB) return rB - rA;
          return (a.name ?? '').localeCompare(b.name ?? '');
        }
      }
    });

    return L;
  }, [scoped, debouncedQ, filters, showFavsOnly, favs]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allFiltered.slice(start, start + PAGE_SIZE);
  }, [allFiltered, page]);

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.location) n++;
    if (filters.price < 5000) n++;
    if (filters.acceptsMedicalAid) n++;
    if (filters.visitedOnly) n++;
    if (filters.premiumOnly) n++;
    if (showFavsOnly) n++;
    return n;
  }, [filters, showFavsOnly]);

  const resetFilters = useCallback(() => {
    setFilters({
      q: '',
      location: '',
      sort: 'rating-desc',
      price: 5000,
      acceptsMedicalAid: '',
      visitedOnly: false,
      premiumOnly: false,
    });
    setShowFavsOnly(false);
    setPage(1);
  }, []);

  const SkeletonRow = () => (
    <div className="p-4 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="space-y-1">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-32 bg-gray-100 rounded mt-1" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-6 w-16 bg-gray-200 rounded" />
        <div className="h-8 w-28 bg-gray-200 rounded" />
      </div>
    </div>
  );

  const initialsFromName = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1][0] ?? '')).toUpperCase();
  };

  const HeartButton: React.FC<{ fav: boolean; onClick: () => void; label: string }> = ({
    fav,
    onClick,
    label,
  }) => (
    <button
      onClick={onClick}
      aria-pressed={fav}
      aria-label={label}
      className="relative p-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
      type="button"
    >
      <span className="inline-block" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <path
            d="M12 21s-7.5-4.9-9.2-7C1.5 11 4 7 7.5 7 9.2 7 10 8 12 9.5 14 8 14.8 7 16.5 7 20 7 22.5 11 21.2 14c-1.7 2.1-9.2 7-9.2 7z"
            fill={fav ? '#fb7185' : 'none'}
          />
          <path
            d="M16.5 7c-1.7 0-2.5 1-4.5 2.5C9.5 8 8.7 7 7 7 3.5 7 1 11 2.3 14c1.7 2.1 9.2 7 9.7 7 .5 0 7.9-4.9 9.7-7C23 11 20.5 7 16.5 7z"
            fill="none"
            stroke={fav ? '#fb7185' : '#9ca3af'}
            strokeWidth="1.25"
          />
        </svg>
      </span>
    </button>
  );

  return (
    <main className="p-6 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/auto-triage" className="text-sm text-teal-700 hover:underline">
            ← Back to Triage
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Practices &amp; Facilities</h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-xs bg-white"
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
            aria-label="Country"
          >
            {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>

          {MAIN_TABS.map((t) => (
            <div key={t} className="relative group">
              <button
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded border text-sm ${
                  tab === t ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
                }`}
                aria-pressed={tab === t}
              >
                {t}
              </button>

              <div
                role="menu"
                className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border bg-white shadow-md p-2 text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-20"
                aria-hidden
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500 px-2 pb-1">
                  Includes
                </div>
                <ul className="space-y-1">
                  {HOVER_MENUS[t].map((item) => (
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
            className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-100"
            aria-expanded={showFilters}
            aria-controls="practice-filters-panel"
            type="button"
          >
            Filters{' '}
            {activeFilterCount ? (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-900 text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      {showFilters && (
        <section
          id="practice-filters-panel"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-white rounded-2xl shadow-sm border p-4 text-sm"
        >
          <input
            type="text"
            placeholder="Search practice name or type"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="rounded border p-2 text-sm"
            aria-label="Search practices"
          />

          <select
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            className="rounded border p-2 text-sm"
            aria-label="Filter by location"
          >
            <option value="">Any Location</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as typeof f.sort }))}
            className="rounded border p-2 text-sm"
            aria-label="Sort practices"
          >
            <option value="rating-desc">Rating</option>
            <option value="name">Name A–Z</option>
            <option value="price">Price (from)</option>
          </select>

          <div className="flex flex-col gap-2">
            <label className="block text-xs text-gray-600">
              Max Price (from): {formatZar(filters.price)}
            </label>
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={filters.price}
              onChange={(e) => setFilters((f) => ({ ...f, price: +e.target.value }))}
              className="w-full"
              aria-label="Max starting price"
            />
          </div>

          <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Payment</div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Medical Aid:</span>
                <select
                  className="border rounded px-2 py-1 text-xs"
                  value={filters.acceptsMedicalAid}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      acceptsMedicalAid: e.target.value as '' | 'yes' | 'no',
                    }))
                  }
                >
                  <option value="">Any</option>
                  <option value="yes">Accepts Medical Aid</option>
                  <option value="no">Private pay only</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-gray-700">History</div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.visitedOnly}
                  onChange={(e) => setFilters((f) => ({ ...f, visitedOnly: e.target.checked }))}
                />
                <span>Previously visited practices only</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={showFavsOnly} onChange={() => setShowFavsOnly((x) => !x)} />
                <span>Favourites only</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-gray-700">Plan / tier</div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.premiumOnly}
                  onChange={(e) => setFilters((f) => ({ ...f, premiumOnly: e.target.checked }))}
                />
                <span>
                  Show <span className="font-semibold">host / premium practices</span> only
                </span>
              </label>
              {!isPremium && (
                <p className="text-[11px] text-gray-500">
                  You can still book at any practice. Premium plans unlock more filters and instant-book features over time.
                </p>
              )}
            </div>
          </div>

          <div className="col-span-full flex items-center gap-3">
            <button onClick={resetFilters} className="text-sm text-gray-600 underline" type="button">
              Reset filters
            </button>
          </div>
        </section>
      )}

      <div className="bg-white rounded-lg border divide-y">
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
            <div className="font-semibold text-gray-900">No practices match these filters</div>
            <p className="mt-1">
              Try clearing some filters or switching category to see more teams, clinics and hospitals.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
              >
                Reset filters
              </button>
              <Link
                href="/auto-triage"
                className="px-3 py-1.5 rounded-full text-xs bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Start a quick triage
              </Link>
              <Link
                href="/appointments"
                className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
              >
                View your appointments
              </Link>
            </div>
          </div>
        ) : (
          paginated.map((p) => {
            const fav = favs.includes(p.id);
            const visited = !!p.hasEncounter;
            const kindLabel =
              p.kind === 'team'
                ? 'Team practice'
                : p.kind === 'clinic'
                  ? 'Clinic'
                  : p.kind === 'hospital'
                    ? 'Hospital'
                    : 'Practice';

            const tierLabel =
              p.premiumTier === 'host'
                ? 'Host / enterprise partner'
                : p.premiumTier === 'pro'
                  ? 'Premium partner'
                  : null;

            return (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  {p.logoUrl ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.logoUrl} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-indigo-600 text-white grid place-items-center font-semibold">
                      {initialsFromName(p.name)}
                    </div>
                  )}

                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-700 bg-gray-50">
                        {kindLabel}
                      </span>
                      {p.subType && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 bg-gray-50">
                          {p.subType}
                        </span>
                      )}
                      {tierLabel && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-800 bg-emerald-50">
                          {tierLabel}
                        </span>
                      )}
                      {visited && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-800 bg-indigo-50">
                          You&apos;ve consulted here
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600">{p.location || '—'}</div>

                    {p.locations && p.locations.length > 1 && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Other locations:{' '}
                        {p.locations.filter((loc) => loc !== p.location).slice(0, 3).join(' · ')}
                        {p.locations.length > 4 ? '…' : ''}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-700">
                      <span className="text-amber-700">
                        ★ {(p.rating ?? 0).toFixed(1)}
                        {p.ratingCount != null && (
                          <span className="text-[11px] text-gray-500">
                            {' '}
                            ({p.ratingCount} rating{p.ratingCount === 1 ? '' : 's'})
                          </span>
                        )}
                      </span>
                      {p.priceFromZAR != null && (
                        <span>
                          From <b>{formatZar(p.priceFromZAR)}</b> / consult
                        </span>
                      )}
                    </div>

                    {typeof p.acceptsMedicalAid === 'boolean' && (
                      <div className="mt-1 text-[11px]">
                        {p.acceptsMedicalAid ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            Accepts Medical Aid / insurance
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700">
                            Private pay only (no Medical Aid claims)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 items-center">
                  <HeartButton
                    fav={fav}
                    onClick={() => toggleFav(p.id)}
                    label={fav ? `Unfavourite ${p.name}` : `Favourite ${p.name}`}
                  />

                  <Link href={`/practices/${encodeURIComponent(p.id)}`} className="text-xs underline text-gray-600">
                    View
                  </Link>

                  <Link
                    href={`/practices/${encodeURIComponent(p.id)}/calendar?country=${country}`}
                    className="px-3 py-1 text-xs rounded bg-indigo-600 text-white"
                  >
                    Book consultation
                  </Link>
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
                key={pageNum}
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
    </main>
  );
}
