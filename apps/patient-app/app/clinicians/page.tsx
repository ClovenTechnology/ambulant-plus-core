// apps/patient-app/app/clinicians/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';
import { CLINICIANS } from '@/mock/clinicians';
import cleanText from '@/lib/cleanText';

const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
type UIClass = typeof UI_CLASSES[number];
const PAGE_SIZE = 10;
const FAV_KEY = 'clinician.favs';

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

export default function CliniciansPage() {
  const router = useRouter();
  const { isPremium } = usePlan();
  const sp = useSearchParams();
  const bootstrappedRef = useRef(false);

  const [tab, setTab] = useState<UIClass>('Doctors');
  const [filters, setFilters] = useState({
    q: '',
    sort: 'rating-desc' as 'rating-desc' | 'name' | 'price',
    specialty: '',
    gender: '',
    location: '',
    price: 5000,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [favs, setFavs] = useState<string[]>([]);
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  // bootstrap from URL once
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const get = (k: string) => sp.get(k) ?? '';
    const cls = normalizeClassParam(get('class'));
    const qText = get('q');
    const avail = get('availability');
    const loc = get('location');
    const gender = get('gender');
    const specFirst = (get('specialties') || '').split(',').map(s => s.trim()).filter(Boolean)[0];
    const onlineParam = get('online');
    const online = onlineParam === '1' || onlineParam?.toLowerCase() === 'true';

    if (cls) setTab(cls);
    setFilters(prev => ({
      ...prev,
      q: qText || prev.q,
      // @ts-ignore demo passthrough
      availability: avail || (prev as any).availability,
      location: loc || prev.location,
      gender: gender || prev.gender,
      specialty: specFirst || prev.specialty,
    }));
    if (online) setOnlineOnly(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // favs
  useEffect(() => {
    try { const raw = localStorage.getItem(FAV_KEY); if (raw) setFavs(JSON.parse(raw)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }, [favs]);
  const toggleFav = (id: string) =>
    setFavs(prev => (prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]));

  // tab-scoped options
  const scoped = useMemo(
    () => CLINICIANS
      .filter(c => c.cls === toDataClass(tab))
      .map(c => ({
        ...c,
        // sanitize text fields to kill mojibake
        name: cleanText(c.name),
        specialty: cleanText(c.specialty),
        location: cleanText(c.location),
      })),
    [tab]
  );

  useEffect(() => {
    const val = <T,>(arr: T[]) => new Set(arr.filter(Boolean) as T[]);
    const validSpecialties = val(scoped.map(c => c.specialty));
    const validGenders = val(scoped.map(c => (c.gender || '').trim()));
    const validLocations = val(scoped.map(c => c.location));
    setFilters(prev => ({
      ...prev,
      specialty: validSpecialties.has(prev.specialty) ? prev.specialty : '',
      gender: validGenders.has(prev.gender) ? prev.gender : '',
      location: validLocations.has(prev.location) ? prev.location : '',
    }));
    setPage(1);
  }, [scoped]);

  const toggleOnline = () => {
    if (!isPremium) return toast('Online-now filter is a Premium feature', 'error');
    setOnlineOnly(v => !v);
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.sort, filters.specialty, filters.gender, filters.location, filters.price, showFavsOnly, onlineOnly]);

  const allFiltered = useMemo(() => {
    let L = scoped;
    const q = filters.q.trim().toLowerCase();
    if (q) L = L.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.specialty.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
    if (filters.specialty) L = L.filter(c => c.specialty === filters.specialty);
    if (filters.gender)    L = L.filter(c => (c.gender || '').trim() === filters.gender);
    if (filters.location)  L = L.filter(c => c.location === filters.location);
    if (filters.price)     L = L.filter(c => c.priceZAR <= filters.price);
    if (onlineOnly)        L = L.filter(c => c.online);
    if (showFavsOnly)      L = L.filter(c => favs.includes(c.id));

    switch (filters.sort) {
      case 'name':  L = [...L].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'price': L = [...L].sort((a, b) => a.priceZAR - b.priceZAR); break;
      default:      L = [...L].sort((a, b) => b.rating - a.rating);
    }
    return L;
  }, [scoped, filters, onlineOnly, showFavsOnly, favs]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allFiltered.slice(start, start + PAGE_SIZE);
  }, [allFiltered, page]);
  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE) || 1;

  // FIX: was Array.from(new Set(...)).filter(Boolean) applied in the wrong order.
  const specialties = useMemo(
    () => Array.from(new Set(scoped.map(c => c.specialty))).filter(Boolean) as string[],
    [scoped]
  );
  const genders     = useMemo(() => {
    const set = new Set(scoped.map(c => (c.gender || '').trim()).filter(Boolean));
    const from = Array.from(set);
    return from.length ? from : ['Male', 'Female', 'Other'];
  }, [scoped]);
  const locations   = useMemo(
    () => Array.from(new Set(scoped.map(c => c.location))).filter(Boolean) as string[],
    [scoped]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.specialty) n++;
    if (filters.gender) n++;
    if (filters.location) n++;
    if (filters.price < 5000) n++;
    if (onlineOnly) n++;
    if (showFavsOnly) n++;
    return n;
  }, [filters, onlineOnly, showFavsOnly]);

  return (
    <main className="p-6 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/auto-triage" className="text-sm text-teal-700 hover:underline">← Back to Triage</Link>
          <h1 className="text-2xl font-bold text-slate-900">Clinicians</h1>
        </div>

        <div className="flex items-center gap-2">
          {UI_CLASSES.map(c => (
            <div key={c} className="relative group">
              <button
                onClick={() => setTab(c)}
                className={`px-3 py-1.5 rounded border text-sm ${tab === c ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {c}
              </button>
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border bg-white shadow-md p-2 text-sm
                           opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-20"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500 px-2 pb-1">Includes</div>
                <ul className="space-y-1">
                  {HOVER_MENUS[c].map(item => (
                    <li key={item} className="px-2 py-1 rounded hover:bg-gray-50 cursor-default">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowFilters(s => !s)}
            className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-100"
            aria-expanded={showFilters}
            aria-controls="filters-panel"
          >
            Filters {activeFilterCount ? <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-900 text-white">{activeFilterCount}</span> : null}
          </button>
        </div>
      </header>

      {showFilters && (
        <section id="filters-panel" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-white rounded-2xl shadow-sm border p-4">
          <input type="text" placeholder="Search name or specialty" value={filters.q}
                 onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className="rounded border p-2 text-sm" />
          <select value={filters.specialty} onChange={e => setFilters(f => ({ ...f, specialty: e.target.value }))} className="rounded border p-2 text-sm">
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.gender} onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))} className="rounded border p-2 text-sm">
            <option value="">Any Gender</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} className="rounded border p-2 text-sm">
            <option value="">Any Location</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600">Sort</label>
              <select value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value as any }))}
                      className="rounded border p-2 text-sm w-full">
                <option value="rating-desc">Rating</option>
                <option value="name">Name A–Z</option>
                <option value="price">Price</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600">Max Price: R{filters.price}</label>
              <input type="range" min={0} max={5000} step={100} value={filters.price}
                     onChange={e => setFilters(f => ({ ...f, price: +e.target.value }))} className="w-full" />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={onlineOnly} onChange={toggleOnline} /> Online now</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showFavsOnly} onChange={() => setShowFavsOnly(f => !f)} /> Favourites only</label>
            </div>
          </div>

          <div className="col-span-full flex items-center gap-3">
            <button
              onClick={() => {
                setFilters({ q: '', sort: 'rating-desc', specialty: '', gender: '', location: '', price: 5000 });
                setShowFavsOnly(false); setOnlineOnly(false);
              }}
              className="text-sm text-gray-600 underline"
            >
              Reset filters
            </button>
          </div>
        </section>
      )}

      <div className="bg-white rounded-lg border divide-y">
        {paginated.length === 0 ? (
          <div className="p-6 text-gray-500">No clinicians match these filters.</div>
        ) : (
          paginated.map(c => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div className="flex gap-3 items-center">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white grid place-items-center font-semibold">
                  {c.name.split(' ').map(p => p[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-600">
                    {c.specialty} • {c.location}
                  </div>
                  <div className="text-xs text-amber-700 mt-1">★ {c.rating.toFixed(1)}</div>
                  {/* Price (ZAR) */}
                  {'priceZAR' in c ? (
                    <div className="text-xs text-gray-700 mt-1">From <b>R{Number(c.priceZAR).toFixed(0)}</b> / consult</div>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${c.online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  {c.online ? 'Online' : 'Offline'}
                </span>
                <button aria-label="Toggle favourite" onClick={() => toggleFav(c.id)}>{favs.includes(c.id) ? '💖' : '🤍'}</button>
                <Link href={`/clinicians/${c.id}`} className="text-xs underline text-gray-600">View</Link>

                <Link
                  href={`/appointments/new?clinicianId=${encodeURIComponent(c.id)}&reason=${encodeURIComponent('Televisit consult')}`}
                  className="px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Quick book
                </Link>

                <button
                  onClick={() => router.push(`/clinicians/${c.id}/calendar`)}
                  className="px-3 py-1 text-xs rounded bg-indigo-600 text-white"
                >
                  Book Televisit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 mt-4">
        <div className="text-sm text-gray-600">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allFiltered.length)} of {allFiltered.length}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 text-sm rounded bg-white border disabled:opacity-50" disabled={page <= 1}>Prev</button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={`px-2 py-1 text-sm rounded ${page === i + 1 ? 'bg-gray-900 text-white' : 'bg-white border'}`}>{i + 1}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 text-sm rounded bg-white border disabled:opacity-50" disabled={page >= totalPages}>Next</button>
        </div>
      </div>
    </main>
  );
}
