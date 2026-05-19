'use client';

import React from 'react';

type Props = {
show: boolean;
isPremium: boolean;
filters: {
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
};
specialties: string[];
genders: string[];
regions: string[];
cities: string[];
languagesAll: string[];
setFilters: React.Dispatch<React.SetStateAction<any>>;
setSortSafe: (value: 'rating-desc' | 'name' | 'price' | 'soonest') => void;
toggleLanguage: (lang: string) => void;
toggleOnline: () => void;
onlineOnly: boolean;
showFavsOnly: boolean;
setShowFavsOnly: React.Dispatch<React.SetStateAction<boolean>>;
openUpgrade: (reason: string, clinician?: { id: string; name: string } | null) => void;
resetFilters: () => void;
};

const CONTROL =
'rounded-xl border border-slate-200 bg-white/88 px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none w-full';

export default function DirectoryFiltersPanel({
show,
isPremium,
filters,
specialties,
genders,
regions,
cities,
languagesAll,
setFilters,
setSortSafe,
toggleLanguage,
toggleOnline,
onlineOnly,
showFavsOnly,
setShowFavsOnly,
openUpgrade,
resetFilters,
}: Props) {
if (!show) return null;

return ( <section
   id="filters-panel"
   className="relative overflow-hidden rounded-[28px] border border-white/55 bg-white/72 backdrop-blur-2xl shadow-[0_16px_60px_rgba(15,23,42,0.08)] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4 md:p-5"
 > <div className="xl:col-span-4 md:col-span-2"> <label className="text-xs text-gray-600 block mb-1">Sort</label>
<select
value={filters.sort}
onChange={(e) =>
setSortSafe(e.target.value as 'rating-desc' | 'name' | 'price' | 'soonest')
}
className={CONTROL}
aria-label="Sort clinicians"
> <option value="rating-desc">Rating</option> <option value="price">Price</option> <option value="name">Name A–Z</option> <option value="soonest">Soonest available (Premium)</option> </select> </div>

```
  <select
    value={filters.specialty}
    onChange={(e) => setFilters((f: any) => ({ ...f, specialty: e.target.value }))}
    className={CONTROL}
    aria-label="Filter by specialty"
  >
    <option value="">All Specialties</option>
    {specialties.map((s) => (
      <option key={s} value={s}>
        {s}
      </option>
    ))}
  </select>

  <select
    value={filters.gender}
    onChange={(e) => setFilters((f: any) => ({ ...f, gender: e.target.value }))}
    className={CONTROL}
    aria-label="Filter by gender"
  >
    <option value="">Any Gender</option>
    {genders.map((g) => (
      <option key={g} value={g}>
        {g}
      </option>
    ))}
  </select>

  <select
    value={filters.region}
    onChange={(e) => setFilters((f: any) => ({ ...f, region: e.target.value, city: '' }))}
    className={CONTROL}
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
    onChange={(e) => setFilters((f: any) => ({ ...f, city: e.target.value }))}
    className={CONTROL}
    aria-label="Filter by city/town"
    disabled={!cities.length}
  >
    <option value="">
      {filters.region ? 'Any City / Town (in region)' : 'Any City / Town'}
    </option>
    {cities.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ))}
  </select>

  {isPremium ? (
    <details className="rounded-xl border border-slate-200 bg-white/88 p-3 shadow-sm">
      <summary className="cursor-pointer text-sm text-slate-700 select-none">
        Languages spoken{' '}
        {filters.languages.length ? (
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-900 text-white">
            {filters.languages.length}
          </span>
        ) : null}
      </summary>
      <div className="mt-2 max-h-44 overflow-auto pr-1 space-y-1">
        {languagesAll.length ? (
          languagesAll.map((lang) => (
            <label key={lang} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.languages.includes(lang)}
                onChange={() => toggleLanguage(lang)}
              />
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
      className="rounded-xl border border-slate-200 bg-white/88 p-3 text-left shadow-sm hover:bg-white"
      aria-label="Languages spoken (Premium)"
    >
      <div className="text-sm text-slate-700">Languages spoken</div>
      <div className="text-xs text-slate-500 mt-0.5">Premium feature</div>
    </button>
  )}

  <div
    className={`rounded-xl border border-slate-200 bg-white/88 p-3 shadow-sm ${
      !isPremium ? 'cursor-pointer hover:bg-white' : ''
    }`}
    onClick={() => {
      if (!isPremium) openUpgrade('Years of experience filter');
    }}
    role={!isPremium ? 'button' : undefined}
    tabIndex={!isPremium ? 0 : undefined}
    onKeyDown={(e) => {
      if (!isPremium && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openUpgrade('Years of experience filter');
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
          setFilters((f: any) => ({ ...f, minYearsExp: +e.target.value }));
        }}
        className="w-full"
        aria-label="Minimum years experience"
        disabled={!isPremium}
      />
      <div className="text-sm font-medium text-slate-900 w-14 text-right">
        {filters.minYearsExp}+
      </div>
    </div>
    {!isPremium ? (
      <div className="text-[11px] text-slate-500 mt-1">Premium feature</div>
    ) : null}
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
        onChange={(e) => setFilters((f: any) => ({ ...f, price: +e.target.value }))}
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
          <input
            type="checkbox"
            checked={showFavsOnly}
            onChange={() => setShowFavsOnly((f) => !f)}
          />
          Favourites only
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.previouslyConsulted === 'yes'}
            onChange={() => {
              if (!isPremium) return openUpgrade('Previously consulted filter');
              setFilters((f: any) => ({
                ...f,
                previouslyConsulted: f.previouslyConsulted === 'yes' ? '' : 'yes',
              }));
            }}
            disabled={!isPremium}
          />
          Previously consulted{' '}
          {!isPremium ? <span className="text-xs text-slate-500">(Premium)</span> : null}
        </label>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-600">Medical Aid:</span>
        <select
          className="rounded-xl border border-slate-200 bg-white/88 px-3 py-2 text-xs text-slate-700 shadow-sm outline-none"
          value={filters.acceptsMedicalAid}
          onChange={(e) =>
            setFilters((f: any) => ({
              ...f,
              acceptsMedicalAid: e.target.value as '' | 'yes' | 'no',
            }))
          }
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
    <button
      onClick={resetFilters}
      className="text-sm text-slate-600 underline"
      type="button"
    >
      Reset filters
    </button>
  </div>
</section>

);
}
