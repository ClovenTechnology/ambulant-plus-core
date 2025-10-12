// apps/patient-app/components/clinicians/CliniciansClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from '@/components/ToastMount';
import { usePlan } from '@/components/context/PlanContext';
import { CLINICIANS } from '@/mock/clinicians';
import { useFavourites } from '@/components/hooks/useFavourites';

type Props = { userId: string | null };

// Core classes (data-backed) + a virtual "Favourites" tab
const CLASSES = ['Doctor', 'Allied Health', 'Wellness'] as const;
const TABS = ['Doctor', 'Allied Health', 'Wellness', 'Favourites'] as const;

// Paging size
const PAGE_SIZE = 5;

const getNextFiveDays = () => {
  const days: { label: string; slots: string[] }[] = [];
  const now = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const label = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    days.push({ label, slots: ['09:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'] });
  }
  return days;
};

const exportFavourites = (favIds: string[]) => {
  const favData = CLINICIANS
    .filter(c => favIds.includes(c.id))
    .map(c => ({
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      location: c.location,
      priceZAR: c.priceZAR,
    }));
  const blob = new Blob([JSON.stringify(favData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'favourites.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default function CliniciansClient({ userId }: Props) {
  const { isPremium } = usePlan();
  const { ids: favs, toggle: toggleFav, loading } = useFavourites(userId);

  type Tab = (typeof TABS)[number];
  const [tab, setTab] = useState<Tab>('Doctor');
  const [filters, setFilters] = useState({
    q: '',
    sort: 'rating-desc',
    specialty: '',
    gender: '',
    location: '',
    price: 2000,
  });
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [booking, setBooking] = useState<{ id: string; name: string } | null>(null);

  // Source list for the selected tab
  const tabbed = useMemo(
    () => (tab === 'Favourites' ? CLINICIANS.filter(c => favs.includes(c.id)) : CLINICIANS.filter(c => c.cls === tab)),
    [tab, favs]
  );

  // Derive filter picklists from the visible source list
  const specialties = useMemo(() => Array.from(new Set(tabbed.map(c => c.specialty))), [tabbed]);
  const genders = useMemo(() => Array.from(new Set(tabbed.map(c => c.gender).filter(Boolean))), [tabbed]);
  const locations = useMemo(() => Array.from(new Set(tabbed.map(c => c.location))), [tabbed]);

  // When tab (or its available options) changes, reset invalid filters and page
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      specialty: specialties.includes(prev.specialty) ? prev.specialty : '',
      gender: genders.includes(prev.gender) ? prev.gender : '',
      location: locations.includes(prev.location) ? prev.location : '',
    }));
    setPage(1);
  }, [tab, specialties, genders, locations]);

  // Hide redundant "Favourites only" toggle if already on Favourites tab
  useEffect(() => {
    if (tab === 'Favourites' && showFavsOnly) setShowFavsOnly(false);
  }, [tab, showFavsOnly]);

  function toggleOnline() {
    if (!isPremium) {
      toast('Online-now filter is a Premium feature', 'error');
      return;
    }
    setOnlineOnly(v => !v);
  }

  // Full filtered list (before pagination)
  const allFiltered = useMemo(() => {
    let L = [...tabbed];

    if (filters.q.trim()) {
      const q = filters.q.toLowerCase();
      L = L.filter(
        c => c.name.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q)
      );
    }
    if (filters.specialty) L = L.filter(c => c.specialty === filters.specialty);
    if (filters.gender) L = L.filter(c => c.gender === filters.gender);
    if (filters.location) L = L.filter(c => c.location === filters.location);
    if (filters.price) L = L.filter(c => c.priceZAR <= filters.price);
    if (onlineOnly) L = L.filter(c => c.online);
    if (showFavsOnly) L = L.filter(c => favs.includes(c.id));

    switch (filters.sort) {
      case 'name':
        L.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price':
        L.sort((a, b) => a.priceZAR - b.priceZAR);
        break;
      default:
        L.sort((a, b) => b.rating - a.rating);
    }

    return L;
  }, [tabbed, filters, onlineOnly, showFavsOnly, favs]);

  // Paginate
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allFiltered.slice(start, start + PAGE_SIZE);
  }, [allFiltered, page]);

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));

  const openBooking = (id: string, name: string) => setBooking({ id, name });

  return (
    <main className="p-6 space-y-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Clinicians</h1>
        <div className="flex items-center gap-3">
          {userId ? (
            <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
              Favourites: cloud-synced
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">
              Favourites: this device
            </span>
          )}
          <Link href="/triage" className="text-sm text-teal-700 hover:underline">
            ← Back to Triage
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(c => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-3 py-1.5 rounded border text-sm ${
              tab === c ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search name or specialty"
          value={filters.q}
          onChange={e => { setFilters(f => ({ ...f, q: e.target.value })); setPage(1); }}
          className="rounded border p-2 text-sm"
        />
        <select
          value={filters.specialty}
          onChange={e => { setFilters(f => ({ ...f, specialty: e.target.value })); setPage(1); }}
          className="rounded border p-2 text-sm"
        >
          <option value="">All Specialties</option>
          {specialties.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.gender}
          onChange={e => { setFilters(f => ({ ...f, gender: e.target.value })); setPage(1); }}
          className="rounded border p-2 text-sm"
        >
          <option value="">Any Gender</option>
          {genders.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={filters.location}
          onChange={e => { setFilters(f => ({ ...f, location: e.target.value })); setPage(1); }}
          className="rounded border p-2 text-sm"
        >
          <option value="">Any Location</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <div className="col-span-full">
          <label className="text-xs text-gray-600">Max Price: R{filters.price}</label>
          <input
            type="range"
            min={0}
            max={5000}
            step={100}
            value={filters.price}
            onChange={e => { setFilters(f => ({ ...f, price: +e.target.value })); setPage(1); }}
            className="w-full"
          />
        </div>

        <div className="flex gap-3 items-center text-sm col-span-full">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={onlineOnly} onChange={toggleOnline} disabled={!isPremium} />
            Online now {!isPremium && <em className="text-rose-600">(Premium)</em>}
          </label>

          {tab !== 'Favourites' && (
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={showFavsOnly}
                onChange={() => { setShowFavsOnly(v => !v); setPage(1); }}
              />
              Favourites only
            </label>
          )}

          <button
            onClick={() => exportFavourites(favs)}
            className="text-sm text-blue-600 underline ml-auto disabled:text-gray-400"
            disabled={loading || favs.length === 0}
            title={loading ? 'Syncing…' : (favs.length ? 'Export favourites' : 'No favourites yet')}
          >
            {loading ? 'Syncing…' : 'Export Favourites'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg border divide-y">
        {paginated.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            {tab === 'Favourites'
              ? 'No favourites yet. Tap the heart on any clinician to add.'
              : 'No clinicians match these filters.'}
          </div>
        ) : (
          paginated.map(c => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div className="flex gap-3 items-center">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white grid place-items-center font-semibold">
                  {c.name.split(' ').map(p => p[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-600">{c.specialty} • {c.location}</div>
                  <div className="text-xs text-gray-400">★ {c.rating.toFixed(1)}</div>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${c.online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  {c.online ? 'Online' : 'Offline'}
                </span>
                <button onClick={() => toggleFav(c.id)} title={favs.includes(c.id) ? 'Remove from favourites' : 'Add to favourites'}>
                  {favs.includes(c.id) ? '💖' : '🤍'}
                </button>
                <Link href={`/clinicians/${c.id}`} className="text-xs underline text-gray-600">View</Link>
                <button onClick={() => openBooking(c.id, c.name)} className="px-3 py-1 text-xs rounded bg-indigo-600 text-white">
                  Book Televisit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 mt-4">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i + 1)}
            className={`px-2 py-1 text-sm rounded ${page === i + 1 ? 'bg-gray-900 text-white' : 'bg-white border'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Booking Modal */}
      {booking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[90%] max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Book with {booking.name}</h3>
            <p className="text-sm text-gray-600">Select a time slot:</p>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {getNextFiveDays().map((day, idx) => (
                <div key={day.label}>
                  <div className={`font-semibold text-sm mb-1 ${idx === 0 ? 'text-indigo-600' : 'text-gray-700'}`}>
                    {day.label}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {day.slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => {
                          toast(`Booked with ${booking.name} on ${day.label} at ${slot}`, 'success');
                          setBooking(null);
                        }}
                        className="text-sm border rounded px-2 py-1 hover:bg-gray-50"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setBooking(null)} className="text-sm text-red-600 underline block ml-auto mt-2">Cancel</button>
          </div>
        </div>
      )}
    </main>
  );
}
