// apps/patient-app/app/practices/[id]/calendar/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

type CountryCode =
  | 'ZA'
  | 'NG'
  | 'KE'
  | 'GH'
  | 'US'
  | 'GB'
  | 'CA'
  | 'AU'
  | 'AE'
  | 'SA'
  | 'CD'
  | 'BW'
  | 'ZW'
  | 'BR'
  | 'AR'
  | 'NZ'
  | 'CU'
  | 'SG'
  | 'JM'
  | 'DM';

const COUNTRY_LABELS: Record<CountryCode, string> = {
  ZA: 'South Africa',
  NG: 'Nigeria',
  KE: 'Kenya',
  GH: 'Ghana',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  CD: 'DR Congo',
  BW: 'Botswana',
  ZW: 'Zimbabwe',
  BR: 'Brazil',
  AR: 'Argentina',
  NZ: 'New Zealand',
  CU: 'Cuba',
  SG: 'Singapore',
  JM: 'Jamaica',
  DM: 'Dominica',
};

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

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
  end: string;
  clinicianId: string;
  clinicianName?: string;
  priceCents?: number;
  currency?: string;
  durationMin?: number;
  bufferMin?: number;
  status?: string;
  consultType?: string;
};

/* ----------------- tiny uid + toasts ----------------- */

function getUid() {
  if (typeof window === 'undefined') return '';

  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);

  if (!v) {
    const token =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${performance.now().toString(36).replace('.', '')}`;

    v = `${token}-u`;
    localStorage.setItem(key, v);
  }

  return v;
}

type Toast = { id: string; text: string; tone?: 'info' | 'success' | 'error' };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(text: string, tone: Toast['tone'] = 'info', ttl = 5000) {
    const id =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${performance.now().toString(36).replace('.', '')}`;
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



function formatZar(cents?: number) {
  if (typeof cents !== 'number') return '—';
  const rands = (cents / 100).toFixed(2);
  return `R ${rands}`;
}

function normalizeCountryParam(v: string | null): CountryCode | null {
  if (!v) return null;

  const s = v.trim().toUpperCase();
  const alias: Record<string, CountryCode> = {
    UK: 'GB',
    USA: 'US',
    DRC: 'CD',
  };

  const code = (alias[s] ?? s) as CountryCode;

  if (code in COUNTRY_LABELS) return code;
  return null;
}

const CLINICIAN_FAV_KEY = 'clinician.favs';

function PracticeCalendarPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const queryParam = useCallback((key: string) => sp?.get(key)?.trim() ?? '', [sp]);
  const { push, Toasts } = useToasts();

  // route params are typically decoded already, but this prevents mismatches if ids contain spaces etc.
  const practiceId = decodeURIComponent(params.id);
  const country = (normalizeCountryParam(queryParam('country')) ?? 'ZA') as CountryCode;


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
    clinicianId: queryParam('clinicianId') || '',
    visitedOnly: false,
    favouritesOnly: false,
    acceptsMedicalAid: '',
    gender: '',
    maxPriceCents: 60000, // R600
  });

  const [confirm, setConfirm] = useState<{ open: boolean; slot?: PracticeSlot }>({ open: false });



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

        const url = `/api/practices/${encodeURIComponent(practiceId)}/patient-view?country=${encodeURIComponent(country)}`;

        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const js = await res.json().catch(() => null);

        if (!res.ok || !js?.practice) {
          throw new Error(js?.error || `Failed to load practice (HTTP ${res.status})`);
        }

        const clinicians: PracticeClinicianSummary[] = Array.isArray(js.clinicians)
          ? js.clinicians.map(
              (c: any): PracticeClinicianSummary => ({
                id: String(c.id ?? c.clinicianId),
                name: cleanText(c.name ?? 'Clinician'),
                specialty: cleanText(c.specialty ?? c.discipline ?? ''),
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
                    : typeof c.medicalAidAccepted === 'boolean'
                      ? c.medicalAidAccepted
                      : undefined,
                hasEncounter: Boolean(c.hasEncounter),
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
            acceptedSchemes: Array.isArray(js.practice.acceptedSchemes)
              ? js.practice.acceptedSchemes.map(String)
              : undefined,
          },
          clinicians,
        };

        if (!cancelled) setView(payload);
      } catch (e: any) {
        if (!cancelled) {
          setPracticeError(e?.message || 'Failed to load practice');
          setView(null);
        }
      } finally {
        if (!cancelled) setLoadingPractice(false);
      }
    }

    loadPractice();

    return () => {
      cancelled = true;
    };
  }, [practiceId, country]);

  /* ----------------- load availability slots ----------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      try {
        setLoadingSlots(true);
        setSlotsError(null);

        const from = new Date();
        const params = new URLSearchParams({
          from: from.toISOString().slice(0, 10),
          days: '14',
          country,
        });

        const url = `/api/practices/${encodeURIComponent(practiceId)}/availability?${params.toString()}`;

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
          start: String(s.start ?? s.startsAt ?? ''),
          end: String(s.end ?? s.endsAt ?? ''),
          clinicianId: String(s.clinicianId ?? s.clinician_id ?? ''),
          clinicianName: s.clinicianName ?? s.clinician_name ?? undefined,
          priceCents:
            typeof s.priceCents === 'number'
              ? s.priceCents
              : typeof s.feeCents === 'number'
                ? s.feeCents
                : undefined,
          currency: s.currency ?? 'ZAR',
          durationMin:
            typeof s.durationMin === 'number'
              ? s.durationMin
              : undefined,
          bufferMin:
            typeof s.bufferMin === 'number'
              ? s.bufferMin
              : undefined,
          status: s.status ?? undefined,
          consultType: s.consultType ?? undefined,
        }));

        if (!cancelled) {
          setSlots(
            mapped.filter(
              (s) =>
                s.start &&
                s.end &&
                s.clinicianId,
            ),
          );
        }
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
  }, [practiceId, country]);

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

  const endsAt = selectedSlot?.end;
  const computedDurationMin = selectedSlot
    ? selectedSlot.durationMin ??
      Math.max(
        1,
        Math.round(
          (new Date(selectedSlot.end).getTime() -
            new Date(selectedSlot.start).getTime()) /
            60_000,
        ),
      )
    : 0;

  async function confirmBooking() {
    if (!selectedSlot) return;

    try {
      const priceCents =
        selectedSlot.priceCents ??
        selectedClinicianForSlot?.priceCents;

      if (!Number.isFinite(Number(priceCents))) {
        throw new Error(
          'This clinician fee could not be confirmed. Please choose another slot or try again.',
        );
      }

      const currency =
        selectedSlot.currency ??
        selectedClinicianForSlot?.currency ??
        'ZAR';

      const payload: any = {
        practiceId,
        clinicianId: selectedSlot.clinicianId,
        startsAt: selectedSlot.start,
        endsAt: selectedSlot.end,
        reason: 'Practice consultation',
        kind: 'standard',
        visitMode: 'televisit',
        country,
        durationMin: computedDurationMin,
        paymentMethod:
          view?.practice?.acceptsMedicalAid && selectedClinicianForSlot?.acceptsMedicalAid
            ? 'medical_aid'
            : 'card',
        meta: {
          source: 'patient.practice-calendar',
          canonicalPracticeSlot: true,
          durationMin: computedDurationMin,
          bufferMin: selectedSlot.bufferMin,
          priceCents,
          currency,
        },
      };

      const res = await fetch('/api/appointments/new', {
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
    <main data-p-ui="patient-practice-calendar-page" className="min-w-0 overflow-x-clip p-6 max-w-6xl mx-auto space-y-4">
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
              Each tile uses that clinician&apos;s current server-confirmed consultation window. Once you pick a slot, we&apos;ll confirm the booking with that clinician.
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
              const end = new Date(s.end);
              const price = s.priceCents ?? c?.priceCents;

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
                <b>{formatZar(selectedSlot.priceCents ?? selectedClinicianForSlot?.priceCents)}</b>
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

export default function PracticeCalendarPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<main data-p-ui="patient-practice-calendar-page" className="min-w-0 overflow-x-clip p-6 text-sm text-slate-600">Loading practice calendar…</main>}>
      <PracticeCalendarPageContent params={params} />
    </Suspense>
  );
}
