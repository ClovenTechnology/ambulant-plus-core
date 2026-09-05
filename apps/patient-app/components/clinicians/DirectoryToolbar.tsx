'use client';

import React from 'react';
type CountryCode = 'ZA';

const COUNTRY_LABELS: Record<CountryCode, string> = {
  ZA: 'South Africa',
};

const COUNTRY_OPTIONS: Array<{ code: CountryCode; label: string }> = [
  { code: 'ZA', label: 'South Africa' },
];

const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
type UIClass = (typeof UI_CLASSES)[number];

const HOVER_MENUS: Record<UIClass, string[]> = {
  Doctors: ['GPs', 'Dentists', 'Specialists'],
  'Allied Health': ['Nurses', 'Pharmacists', 'Therapists'],
  Wellness: ['Chiropractor', 'Dieticians', 'Lifestyle'],
};

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

type FiltersShape = {
  q: string;
  sort: 'rating-desc' | 'name' | 'price' | 'soonest';
};

type ChipItem = {
  label: string;
  onRemove: () => void;
};

type Props = {
  country: CountryCode;
  setCountry: (value: CountryCode) => void;
  tab: UIClass;
  setTab: (value: UIClass) => void;
  filters: FiltersShape;
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilterCount: number;
  resetFilters: () => void;
  setSortSafe: (value: 'rating-desc' | 'name' | 'price' | 'soonest') => void;
  activeChips: ChipItem[];
  scrolled: boolean;
};

const CONTROL =
  'rounded-xl border border-slate-200 bg-white/88 px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none';

export default function DirectoryToolbar({
  country,
  setCountry,
  tab,
  setTab,
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  activeFilterCount,
  resetFilters,
  setSortSafe,
  activeChips,
  scrolled,
}: Props) {
  return (
    <div className={`sticky top-0 z-40 transition-all duration-200 ${scrolled ? 'pt-2' : ''}`}>
      <div
        className={`mx-4 mt-4 rounded-[24px] border border-white/60 bg-white/78 backdrop-blur-2xl ${
          scrolled
            ? 'shadow-[0_16px_50px_rgba(15,23,42,0.10)]'
            : 'shadow-[0_8px_30px_rgba(15,23,42,0.05)]'
        }`}
      >
        <div className="px-5 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm">
                  Ambulant+ clinician directory
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 truncate">
                  Clinicians
                </h1>
                <div className="text-[12px] text-slate-500 mt-1 hidden sm:block">
                  Discover, compare, shortlist and book with more confidence.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <input
                type="text"
                placeholder="Search clinicians, specialties, location…"
                value={filters.q}
                onChange={(e) => setFilters((f: any) => ({ ...f, q: e.target.value }))}
                className={`w-[260px] max-w-[70vw] ${CONTROL}`}
                aria-label="Search clinicians"
              />

              <select
                value={filters.sort}
                onChange={(e) => setSortSafe(e.target.value as 'rating-desc' | 'name' | 'price' | 'soonest')}
                className={CONTROL}
                aria-label="Sort"
              >
                <option value="rating-desc">Recommended</option>
                <option value="soonest">Soonest available (Premium)</option>
                <option value="price">Price</option>
                <option value="name">Name A–Z</option>
              </select>

              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-3 py-2.5 shadow-sm">
                <span
                  className="text-base leading-none"
                  aria-hidden
                  title={(COUNTRY_LABELS as any)[country] ?? country}
                >
                  {flagEmojiFromCountryCode(country)}
                </span>
                <select
                  className="text-sm bg-transparent outline-none text-slate-700"
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

              {UI_CLASSES.map((c) => (
                <div key={c} className="relative group">
                  <button
                    onClick={() => setTab(c)}
                    className={`px-3.5 py-2 rounded-full border text-sm transition-all ${
                      tab === c
                        ? 'bg-slate-950 text-white border-slate-950 shadow-[0_10px_20px_rgba(15,23,42,0.16)]'
                        : 'bg-white/85 hover:bg-white text-slate-700 border-slate-200'
                    }`}
                    aria-pressed={tab === c}
                    type="button"
                  >
                    {c}
                  </button>

                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 min-w-[190px] rounded-[18px] border border-white/60 bg-white/92 backdrop-blur-xl shadow-[0_16px_32px_rgba(15,23,42,0.10)] p-2 text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-20"
                    aria-hidden
                  >
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 px-2 pb-1">
                      Includes
                    </div>
                    <ul className="space-y-1">
                      {HOVER_MENUS[c].map((item) => (
                        <li
                          key={item}
                          className="px-2 py-1.5 rounded-xl hover:bg-slate-50 cursor-default text-slate-700"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setShowFilters((s) => !s)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white/88 hover:bg-white shadow-sm"
                aria-expanded={showFilters}
                aria-controls="filters-panel"
                type="button"
              >
                Filters
                {activeFilterCount ? (
                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-950 text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>

              {activeFilterCount ? (
                <button
                  onClick={resetFilters}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white/88 hover:bg-white shadow-sm"
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {activeChips.length ? (
            <div className="mt-3 flex items-center gap-2 overflow-auto pb-1">
              {activeChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-xs text-slate-700 shadow-sm"
                >
                  <span className="max-w-[220px] truncate">{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="ml-0.5 rounded-full px-1 text-slate-500 hover:text-slate-900"
                    aria-label={`Remove ${chip.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}