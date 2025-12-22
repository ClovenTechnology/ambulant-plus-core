// apps/patient-app/app/practices/[id]/calendar/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import * as PracticesMock from '@/mock/practices';
import { getMockMedicalAidsForCountry } from '@/mock/medical-aid';
import { getMockCliniciansForCountry, COUNTRY_LABELS } from '@/mock/clinicians-by-country';
import type { CountryCode } from '@/mock/clinicians-shared';
import cleanText from '@/lib/cleanText';

type PracticeClinicianSummary = {
  id: string;
  name: string;
  specialty?: string;
  gender?: string;
  priceCents?: number;
  currency?: string;
  rating?: number;
  acceptsMedicalAid?: boolean;
  hasEncounter?: boolean;
};

type PracticePatientView = {
  practice: {
    id: string;
    name: string;
    acceptsMedicalAid?: boolean;
    acceptedSchemes?: string[];
  };
  clinicians?: PracticeClinicianSummary[];
};

type PracticeSlot = {
  start: string;
  end?: string;
  clinicianId: string;
  clinicianName?: string;
  priceCents?: number;
  currency?: string;
};

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

/* ----------------- tiny uid + toasts ----------------- */

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

type Toast = { id: string; text: string; tone?: 'info' | 'success' | 'error' };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(text: string, tone: Toast['tone'] = 'info', ttl = 5000) {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }
  function remove(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }
  const Toasts = () => (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1200 }} aria-live="polite">
      <div className="flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded shadow text-sm ${
              t.tone === 'success'
                ? 'bg-green-50 text-green-800'
                : t.tone === 'error'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-white text-gray-800'
            }`}
          >
            {t.text}
            <button onClick={() => remove(t.id)} className="ml-3 text-xs text-gray-500" type="button">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
  return { push, Toasts };
}

function addMinutes(iso: string, mins: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

function formatZar(cents?: number) {
  if (typeof cents !== 'number') return '—';
  const rands = (cents / 100).toFixed(2);
  return `R ${rands}`;
}

function normalizeCountryParam(v: string | null): CountryCode | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  if ((COUNTRY_LABELS as any)[s]) return s as CountryCode;
  return null;
}

const CLINICIAN_FAV_KEY = 'clinician.favs';

/* ----------------- directory fetch + safe mock helpers ----------------- */

async function fetchDirectoryPractices(country: CountryCode): Promise<any[]> {
  try {
    const url = `/api/practices?country=${encodeURIComponent(country)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const js = await res.json().catch(() => null);

    const list: any[] = Array.isArray(js)
      ? js
      : Array.isArray(js?.practices)
        ? js.practices
        : [];

    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function safeGetMockPracticesForCountry(country: CountryCode): any[] {
  const maybeFn =
    (PracticesMock as any).getMockPracticesForCountry ??
    (PracticesMock as any).default?.getMockPracticesForCountry;

  if (typeof maybeFn === 'function') {
    try {
      const res = maybeFn(country);
      if (Array.isArray(res)) return res;
    } catch {}
  }

  const byCountry =
    (PracticesMock as any).PRACTICES_BY_COUNTRY ??
    (PracticesMock as any).byCountry ??
    (PracticesMock as any).default?.PRACTICES_BY_COUNTRY ??
    (PracticesMock as any).default?.byCountry ??
    null;

  if (byCountry && typeof byCountry === 'object') {
    const list = (byCountry as any)[country];
    if (Array.isArray(list)) return list;
  }

  const base =
    (PracticesMock as any).PRACTICES ??
    (PracticesMock as any).MOCK_PRACTICES ??
    (PracticesMock as any).default?.PRACTICES ??
    (PracticesMock as any).default?.MOCK_PRACTICES ??
    (PracticesMock as any).default ??
    [];

  if (Array.isArray(base)) return base;
  if (Array.isArray((base as any)?.PRACTICES)) return (base as any).PRACTICES;

  return [];
}

function safeAllMockLists(): any[][] {
  const byCountry =
    (PracticesMock as any).PRACTICES_BY_COUNTRY ??
    (PracticesMock as any).byCountry ??
    (PracticesMock as any).default?.PRACTICES_BY_COUNTRY ??
    (PracticesMock as any).default?.byCountry ??
    null;

  if (byCountry && typeof byCountry === 'object') {
    return Object.values(byCountry).filter(Array.isArray) as any[][];
  }

  const base =
    (PracticesMock as any).PRACTICES ??
    (PracticesMock as any).MOCK_PRACTICES ??
    (PracticesMock as any).default?.PRACTICES ??
    (PracticesMock as any).default?.MOCK_PRACTICES ??
    (PracticesMock as any).default ??
    [];

  if (Array.isArray(base)) return [base];
  if (Array.isArray((base as any)?.PRACTICES)) return [(base as any).PRACTICES];

  return [];
}

/**
 * Minimal view builder so the calendar can still show a title in “directory only” mode.
 * Accepts encoded ids too (route params may be encoded).
 */
function buildPracticeViewFromLists(id: string, country: CountryCode, lists: any[][]): PracticePatientView | null {
  let p: any | null = null;

  const wanted = String(id);
  for (const list of lists) {
    const found = list.find((x: any) => String(x?.id) === wanted || String(x?.slug) === wanted);
    if (found) {
      p = found;
      break;
    }
  }

  if (!p) return null;

  const schemePool = getMockMedicalAidsForCountry(country).map((x) => x.name);
  const acceptedSchemes =
    (typeof p.acceptsMedicalAid === 'boolean' ? p.acceptsMedicalAid : !!p.medicalAidAccepted) &&
    (!p.acceptedSchemes || p.acceptedSchemes.length === 0)
      ? schemePool.slice(0, 3)
      : p.acceptedSchemes ?? [];

  return {
    practice: {
      id: String(p.id ?? id),
      name: String(p.name ?? p.displayName ?? 'Practice'),
      acceptsMedicalAid: typeof p.acceptsMedicalAid === 'boolean' ? p.acceptsMedicalAid : !!p.medicalAidAccepted,
      acceptedSchemes: acceptedSchemes.length ? acceptedSchemes : undefined,
    },
    clinicians: [],
  };
}

/* ----------------- mock clinicians + mock slots ----------------- */

function pickPracticeMockClinicians(country: CountryCode): PracticeClinicianSummary[] {
  const pool = (getMockCliniciansForCountry(country) as any[]) ?? [];
  const pick = pool.slice(0, 6);

  return pick.map((c: any, i: number) => {
    const priceCents =
      typeof c.priceCents === 'number'
        ? c.priceCents
        : typeof c.feeCents === 'number'
          ? c.feeCents
          : typeof c.priceZAR === 'number'
            ? Math.round(Number(c.priceZAR) * 100)
            : 60000;

    return {
      id: String(c.id ?? `mock-${country}-${i}`),
      name: cleanText(String(c.name ?? 'Clinician')),
      specialty: cleanText(String(c.specialty ?? c.discipline ?? 'General Practice')),
      gender: c.gender ?? undefined,
      priceCents,
      currency: c.currency ?? (country === 'ZA' ? 'ZAR' : 'USD'),
      rating: typeof c.rating === 'number' ? c.rating : typeof c.avgRating === 'number' ? c.avgRating : undefined,
      acceptsMedicalAid:
        typeof c.acceptsMedicalAid === 'boolean'
          ? c.acceptsMedicalAid
          : typeof c.medicalAidAccepted === 'boolean'
            ? c.medicalAidAccepted
            : undefined,
      hasEncounter: Math.random() < 0.3,
    };
  });
}

function buildMockSlots(clinicians: PracticeClinicianSummary[], days = 14, durationMin = 45): PracticeSlot[] {
  const out: PracticeSlot[] = [];
  const base = new Date();
  base.setHours(9, 0, 0, 0);

  for (let d = 0; d < days; d++) {
    const day = new Date(base);
    day.setDate(base.getDate() + d);

    for (const c of clinicians) {
      // two slots per day per clinician
      const s1 = new Date(day);
      s1.setHours(9, 0, 0, 0);

      const s2 = new Date(day);
      s2.setHours(14, 0, 0, 0);

      for (const s of [s1, s2]) {
        const startIso = s.toISOString();
        out.push({
          start: startIso,
          end: addMinutes(startIso, durationMin),
          clinicianId: c.id,
          clinicianName: c.name,
          priceCents: c.priceCents,
          currency: c.currency,
        });
      }
    }
  }

  return out;
}

export default function PracticeCalendarPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { push, Toasts } = useToasts();

  // route params are typically decoded already, but this prevents mismatches if ids contain spaces etc.
  const practiceId = decodeURIComponent(params.id);
  const country = (normalizeCountryParam(sp.get('country')) ?? 'ZA') as CountryCode;

  // For now: live booking available only for ZA; other countries are directory-only even if gateway exists
  const apiEnabled = Boolean(GATEWAY) && country === 'ZA';

  const [view, setView] = useState<PracticePatientView | null>(null);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const [slots, setSlots] = useState<PracticeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [favClinicians, setFavClinicians] = useState<string[]>([]);

  const [filters, setFilters] = useState<{
    clinicianId: string; // '' = any
    visitedOnly: boolean;
    favouritesOnly: boolean;
    acceptsMedicalAid: '' | 'yes' | 'no';
    gender: string;
    maxPriceCents: number;
  }>({
    clinicianId: sp.get('clinicianId') || '',
    visitedOnly: false,
    favouritesOnly: false,
    acceptsMedicalAid: '',
    gender: '',
    maxPriceCents: 60000, // R600
  });

  const [confirm, setConfirm] = useState<{ open: boolean; slot?: PracticeSlot }>({ open: false });

  const tileMinutes = 30;
  const defaultDurationMin = 45;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLINICIAN_FAV_KEY);
      if (raw) setFavClinicians(JSON.parse(raw));
    } catch {}
  }, []);

  /* ----------------- load practice + clinicians ----------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadPractice() {
      try {
        setLoadingPractice(true);
        setPracticeError(null);

        const directoryList = await fetchDirectoryPractices(country);

        // Directory-only mode (non-ZA or no gateway): show practice + mock clinicians
        if (!apiEnabled) {
          const listsToSearch: any[][] = [];

          if (directoryList.length) listsToSearch.push(directoryList);
          listsToSearch.push(safeGetMockPracticesForCountry(country));
          listsToSearch.push(...safeAllMockLists());

          const fromLists = buildPracticeViewFromLists(practiceId, country, listsToSearch);
          if (!fromLists) throw new Error('Practice not found (directory data only).');

          const mockClinicians = pickPracticeMockClinicians(country);

          if (!cancelled) {
            setView({ ...fromLists, clinicians: mockClinicians });
            setPracticeError(
              country === 'ZA'
                ? 'Live booking calendar is not available in this environment. Showing example clinicians + slots.'
                : 'Live booking is currently available for South Africa (ZA) only. Showing example clinicians + slots.',
            );
          }
          return;
        }

        // Live mode (ZA + gateway)
        const res = await fetch(`${GATEWAY}/api/practices/${encodeURIComponent(practiceId)}/patient-view`, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const js = await res.json().catch(() => null);
        if (!res.ok || !js || !js.practice) {
          throw new Error(js?.error || `Failed to load practice (HTTP ${res.status})`);
        }

        const clinicians: PracticeClinicianSummary[] = Array.isArray(js.clinicians)
          ? js.clinicians.map(
              (c: any): PracticeClinicianSummary => ({
                id: String(c.id ?? c.clinicianId),
                name: cleanText(String(c.name ?? 'Clinician')),
                specialty: cleanText(String(c.specialty ?? c.discipline ?? '')),
                gender: c.gender ?? undefined,
                priceCents:
                  typeof c.priceCents === 'number'
                    ? c.priceCents
                    : typeof c.feeCents === 'number'
                      ? c.feeCents
                      : undefined,
                currency: c.currency ?? 'ZAR',
                rating:
                  typeof c.rating === 'number'
                    ? c.rating
                    : typeof c.avgRating === 'number'
                      ? c.avgRating
                      : undefined,
                acceptsMedicalAid:
                  typeof c.acceptsMedicalAid === 'boolean'
                    ? c.acceptsMedicalAid
                    : !!c.medicalAidAccepted,
                hasEncounter: !!c.hasEncounter,
              }),
            )
          : [];

        const payload: PracticePatientView = {
          practice: {
            id: String(js.practice.id ?? practiceId),
            name: String(js.practice.name ?? 'Practice'),
            acceptsMedicalAid:
              typeof js.practice.acceptsMedicalAid === 'boolean'
                ? js.practice.acceptsMedicalAid
                : undefined,
            acceptedSchemes: Array.isArray(js.practice.acceptedSchemes) ? js.practice.acceptedSchemes : undefined,
          },
          clinicians,
        };

        if (!cancelled) setView(payload);
      } catch (e: any) {
        if (!cancelled) {
          const directoryList = await fetchDirectoryPractices(country);

          const listsToSearch: any[][] = [];
          if (directoryList.length) listsToSearch.push(directoryList);
          listsToSearch.push(safeGetMockPracticesForCountry(country));
          listsToSearch.push(...safeAllMockLists());

          const fallbackView = buildPracticeViewFromLists(practiceId, country, listsToSearch);

          if (fallbackView) {
            const mockClinicians = pickPracticeMockClinicians(country);
            setView({ ...fallbackView, clinicians: mockClinicians });
            setPracticeError((e?.message || 'Failed to load practice') + ' – showing example clinicians + slots.');
          } else {
            setPracticeError(e?.message || 'Failed to load practice');
            setView(null);
          }
        }
      } finally {
        if (!cancelled) setLoadingPractice(false);
      }
    }

    loadPractice();
    return () => {
      cancelled = true;
    };
  }, [practiceId, country, apiEnabled]);

  /* ----------------- load availability slots ----------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      try {
        setLoadingSlots(true);
        setSlotsError(null);

        // Directory-only mode: generate mock slots from the clinicians in view
        if (!apiEnabled) {
          const mockClinicians = (view?.clinicians?.length ? view.clinicians : pickPracticeMockClinicians(country)) ?? [];
          if (!cancelled) {
            setSlots(buildMockSlots(mockClinicians, 14, defaultDurationMin));
            setSlotsError(null);
          }
          return;
        }

        const from = new Date();
        const params = new URLSearchParams({
          from: from.toISOString().slice(0, 10),
          days: '14',
          slot: String(tileMinutes),
        });

        const url = `${GATEWAY}/api/practices/${encodeURIComponent(practiceId)}/availability?${params.toString()}`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const js = await res.json().catch(() => null);
        if (!res.ok || !js) {
          throw new Error(js?.error || `Failed to load practice availability (HTTP ${res.status})`);
        }

        const rawSlots: any[] = Array.isArray(js.slots) ? js.slots : [];
        const mapped: PracticeSlot[] = rawSlots.map((s: any) => ({
          start: s.start,
          end: s.end,
          clinicianId: String(s.clinicianId ?? s.clinician_id),
          clinicianName: s.clinicianName ?? s.clinician_name ?? undefined,
          priceCents: typeof s.priceCents === 'number' ? s.priceCents : typeof s.feeCents === 'number' ? s.feeCents : undefined,
          currency: s.currency ?? 'ZAR',
        }));

        if (!cancelled) setSlots(mapped);
      } catch (e: any) {
        if (!cancelled) {
          setSlotsError(e?.message || 'Failed to load availability');
          setSlots([]);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [practiceId, apiEnabled, country, view, tileMinutes, defaultDurationMin]);

  const clinicians = view?.clinicians ?? [];

  const clinicianMap = useMemo(() => {
    const m = new Map<string, PracticeClinicianSummary>();
    for (const c of clinicians) m.set(c.id, c);
    return m;
  }, [clinicians]);

  const filteredClinicians = useMemo(() => {
    let L = clinicians.slice();
    if (filters.clinicianId) L = L.filter((c) => c.id === filters.clinicianId);
    if (filters.visitedOnly) L = L.filter((c) => c.hasEncounter);
    if (filters.favouritesOnly) L = L.filter((c) => favClinicians.includes(c.id));
    if (filters.acceptsMedicalAid === 'yes') L = L.filter((c) => c.acceptsMedicalAid);
    if (filters.acceptsMedicalAid === 'no') L = L.filter((c) => c.acceptsMedicalAid === false);
    if (filters.gender) L = L.filter((c) => (c.gender || '').toLowerCase() === filters.gender.toLowerCase());
    if (filters.maxPriceCents) L = L.filter((c) => (c.priceCents ?? Infinity) <= filters.maxPriceCents);

    L.sort((a, b) => {
      const seenA = a.hasEncounter ? 1 : 0;
      const seenB = b.hasEncounter ? 1 : 0;
      if (seenA !== seenB) return seenB - seenA;

      const favA = favClinicians.includes(a.id) ? 1 : 0;
      const favB = favClinicians.includes(b.id) ? 1 : 0;
      if (favA !== favB) return favB - favA;

      const rA = a.rating ?? 0;
      const rB = b.rating ?? 0;
      if (rA !== rB) return rB - rA;

      return a.name.localeCompare(b.name);
    });

    return L;
  }, [clinicians, filters, favClinicians]);

  const allowedClinicianIds = useMemo(() => new Set(filteredClinicians.map((c) => c.id)), [filteredClinicians]);

  const filteredSlots = useMemo(() => {
    if (!slots.length) return [];
    return slots.filter((s) => allowedClinicianIds.has(s.clinicianId));
  }, [slots, allowedClinicianIds]);

  const selectedClinician = filters.clinicianId ? clinicians.find((c) => c.id === filters.clinicianId) || null : null;

  const hasAnySlots = slots.length > 0;
  const hasFilteredSlots = filteredSlots.length > 0;

  const otherCliniciansWithSlots = useMemo(() => {
    if (!filters.clinicianId || hasFilteredSlots || !slots.length) return [];
    const ids = new Set<string>();
    for (const s of slots) {
      if (s.clinicianId !== filters.clinicianId) ids.add(s.clinicianId);
    }
    const others: PracticeClinicianSummary[] = [];
    ids.forEach((id) => {
      const c = clinicianMap.get(id);
      if (c) others.push(c);
    });
    others.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return others.slice(0, 3);
  }, [filters.clinicianId, hasFilteredSlots, slots, clinicianMap]);

  const title = view?.practice?.name ? `Book at ${view.practice.name}` : 'Practice calendar';

  const handleSelectSlot = (slot: PracticeSlot) => setConfirm({ open: true, slot });

  const selectedSlot = confirm.slot;
  const selectedClinicianForSlot = selectedSlot && clinicianMap.get(selectedSlot.clinicianId);

  const computedDurationMin = defaultDurationMin;
  const endsAt = selectedSlot ? addMinutes(selectedSlot.start, computedDurationMin) : undefined;

  async function confirmBooking() {
    if (!selectedSlot) return;

    try {
      if (!apiEnabled) throw new Error('Live booking is currently available for South Africa (ZA) only.');

      const priceCents = selectedSlot.priceCents ?? selectedClinicianForSlot?.priceCents ?? 60000;
      const currency = selectedSlot.currency ?? selectedClinicianForSlot?.currency ?? 'ZAR';

      const payload: any = {
        practiceId,
        clinicianId: selectedSlot.clinicianId,
        startsAt: selectedSlot.start,
        endsAt: endsAt ?? addMinutes(selectedSlot.start, computedDurationMin),
        priceCents,
        currency,
        type: 'standard',
        meta: {
          source: 'patient.practice-calendar',
          tileMinutes,
          durationMin: computedDurationMin,
        },
      };

      const res = await fetch(`${GATEWAY}/api/appointments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'patient',
          'x-uid': getUid(),
        },
        body: JSON.stringify(payload),
      });
      const js = await res.json().catch(() => null);
      if (!res.ok || js?.error) throw new Error(js?.error || `Booking failed (HTTP ${res.status})`);

      push('Appointment booked ✔️', 'success');
      setConfirm({ open: false, slot: undefined });
      router.push('/appointments');
    } catch (e: any) {
      push(e?.message || 'Failed to book appointment', 'error');
    }
  }

  const maxPriceRand = Math.round(filters.maxPriceCents / 100);

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <Toasts />

      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-teal-700 hover:underline" type="button">
          ← Back
        </button>

        <div className="text-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="text-xs text-gray-600 mt-1">
            View availability for all clinicians in this practice, or filter down to a specific clinician you prefer.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/practices" className="text-sm text-gray-600 hover:underline">
            Practices
          </Link>
        </div>
      </div>

      {!apiEnabled && (
        <div className="text-sm text-amber-800 border border-amber-200 bg-amber-50 px-3 py-2 rounded">
          Live booking is currently available for <b>South Africa (ZA)</b> only. Showing example clinicians + slots.
        </div>
      )}

      {practiceError && (
        <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
          {practiceError}
        </div>
      )}

      {/* Filters bar */}
      <section className="bg-white border rounded-lg p-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col text-xs">
            <span className="mb-1 text-gray-600">Clinician</span>
            <select
              value={filters.clinicianId}
              onChange={(e) => setFilters((f) => ({ ...f, clinicianId: e.target.value }))}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">Any available clinician</option>
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.specialty ? ` — ${c.specialty}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col text-xs">
            <span className="mb-1 text-gray-600">Gender</span>
            <select
              value={filters.gender}
              onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other / unspecified</option>
            </select>
          </div>

          <div className="flex flex-col text-xs">
            <span className="mb-1 text-gray-600">Medical Aid</span>
            <select
              value={filters.acceptsMedicalAid}
              onChange={(e) => setFilters((f) => ({ ...f, acceptsMedicalAid: e.target.value as '' | 'yes' | 'no' }))}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="yes">Accepts Medical Aid</option>
              <option value="no">Private pay only</option>
            </select>
          </div>

          <div className="flex flex-col text-xs max-w-xs">
            <span className="mb-1 text-gray-600">Max fee (from)</span>
            <span className="text-[11px] text-gray-500 mb-1">Up to about R{maxPriceRand}</span>
            <input
              type="range"
              min={20000}
              max={100000}
              step={5000}
              value={filters.maxPriceCents}
              onChange={(e) => setFilters((f) => ({ ...f, maxPriceCents: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.visitedOnly}
              onChange={(e) => setFilters((f) => ({ ...f, visitedOnly: e.target.checked }))}
            />
            <span>Previously seen clinicians only</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.favouritesOnly}
              onChange={(e) => setFilters((f) => ({ ...f, favouritesOnly: e.target.checked }))}
            />
            <span>Favourite clinicians only</span>
          </label>
        </div>

        <p className="text-[11px] text-gray-500">
          This calendar is for <b>new consultations</b>. Follow-ups should be booked from your{' '}
          <Link href="/encounters" className="underline">
            Case / Encounter
          </Link>{' '}
          context.
        </p>
      </section>

      {/* Availability tiles */}
      <section className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium text-sm">Available slots (next 14 days)</div>
            <p className="text-xs text-gray-600">
              Each tile is a {tileMinutes}-minute slot. Once you pick a slot, we&apos;ll confirm the booking with that clinician.
            </p>
          </div>
          {loadingSlots && <div className="text-xs text-gray-500">Loading availability…</div>}
        </div>

        {slotsError && (
          <div className="text-sm text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded">
            {slotsError}
          </div>
        )}

        {!loadingSlots && !slotsError && hasAnySlots && !hasFilteredSlots && (
          <div className="text-xs text-gray-700 border border-amber-200 bg-amber-50 px-3 py-2 rounded">
            {filters.clinicianId && selectedClinician ? (
              <>
                {selectedClinician.name} doesn&apos;t have any open slots in this window with the current filters.
                {otherCliniciansWithSlots.length > 0 && (
                  <>
                    {' '}
                    However,{' '}
                    <b>
                      {otherCliniciansWithSlots.length} other clinician{otherCliniciansWithSlots.length === 1 ? '' : 's'}
                    </b>{' '}
                    in this practice are available:{' '}
                    <span className="font-medium">{otherCliniciansWithSlots.map((c) => c.name).join(', ')}</span>. Try clearing some filters or choosing &quot;Any available clinician&quot;.
                  </>
                )}
              </>
            ) : (
              <>No slots match the current filters. Try clearing some filters.</>
            )}
          </div>
        )}

        {!loadingSlots && !slotsError && !hasAnySlots && (
          <div className="text-sm text-gray-600">
            This practice has no published availability in the next few days. You can still check individual clinicians from their profile pages.
          </div>
        )}

        {!loadingSlots && !slotsError && hasFilteredSlots && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 text-xs">
            {filteredSlots.map((s) => {
              const c = clinicianMap.get(s.clinicianId);
              const labelName = s.clinicianName ?? c?.name ?? 'Clinician';
              const start = new Date(s.start);
              const endIso = s.end ?? addMinutes(s.start, defaultDurationMin);
              const end = new Date(endIso);
              const price = s.priceCents ?? c?.priceCents ?? 60000;

              return (
                <li key={`${s.start}-${s.clinicianId}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectSlot(s)}
                    className="w-full text-left border rounded-lg px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="font-medium text-[13px] mb-0.5">
                      {start.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-[11px] text-gray-700">
                      {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-800">
                      {labelName}
                      {c?.specialty && <span className="text-gray-500"> · {c.specialty}</span>}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-700">
                      Fee (approx.): <b>{formatZar(price)}</b>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">Click to confirm booking with this clinician at this time.</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Confirm modal */}
      {confirm.open && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-4 w-full max-w-md text-sm">
            <h2 className="text-lg font-semibold mb-2">Confirm booking</h2>
            <div className="space-y-1 text-gray-700">
              <div>
                <span className="text-gray-500">Practice:</span> <b>{view?.practice?.name ?? 'Practice'}</b>
              </div>
              <div>
                <span className="text-gray-500">Clinician:</span>{' '}
                <b>{selectedClinicianForSlot?.name ?? selectedSlot.clinicianName ?? 'Clinician'}</b>
                {selectedClinicianForSlot?.specialty && (
                  <span className="text-xs text-gray-500"> · {selectedClinicianForSlot.specialty}</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Starts:</span> <b>{new Date(selectedSlot.start).toLocaleString()}</b>
              </div>
              <div>
                <span className="text-gray-500">Ends:</span> <b>{endsAt ? new Date(endsAt).toLocaleString() : '—'}</b>
              </div>
              <div>
                <span className="text-gray-500">Fee (approx.):</span>{' '}
                <b>{formatZar(selectedSlot.priceCents ?? selectedClinicianForSlot?.priceCents ?? 60000)}</b>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">
                This booking will create a <b>new consultation</b> at this practice. Follow-up appointments should be booked from your Case / Encounter view.
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded border text-sm"
                onClick={() => setConfirm({ open: false, slot: undefined })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                onClick={confirmBooking}
                disabled={!apiEnabled}
                aria-disabled={!apiEnabled}
              >
                Confirm &amp; book
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
