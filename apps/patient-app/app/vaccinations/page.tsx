'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format, isAfter, isBefore, startOfToday } from 'date-fns';
import { FiPlus, FiClock, FiCalendar } from 'react-icons/fi';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

type Vaccination = {
  id: string;
  vaccine: string;
  date?: string | null;
  batch?: string | null;
  notes?: string | null;
  clinician?: string | null;
  facility?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  followupAt?: string | null;
  followupLabel?: string | null;
  ehrTxId?: string | null;
  createdAt?: string;
};

type TabKey = 'all' | 'past' | 'upcoming';

function toLocal(iso?: string | null) {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return iso ?? '';
  }
}

export default function PatientVaccinationsPage() {
  const [items, setItems] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vaccine: '',
    date: '',
    batch: '',
    clinician: '',
    facility: '',
    notes: '',
  });

  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // Follow-up scheduling UI
  const [scheduleTarget, setScheduleTarget] = useState<Vaccination | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!GATEWAY) {
        setError('Gateway origin not configured');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${GATEWAY}/patient/vaccinations`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => ({ items: [] }));
        if (!mounted) return;
        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (err: any) {
        console.error('vaccinations load failed', err);
        if (mounted) setError(err.message || 'Failed to load vaccinations');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function resetForm() {
    setForm({
      vaccine: '',
      date: '',
      batch: '',
      clinician: '',
      facility: '',
      notes: '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!GATEWAY) {
      setError('Gateway origin not configured');
      return;
    }
    if (!form.vaccine.trim()) {
      alert('Please enter vaccine name');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const body: any = {
        vaccine: form.vaccine.trim(),
        date: form.date || undefined,
        batch: form.batch || undefined,
        clinician: form.clinician || undefined,
        facility: form.facility || undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch(`${GATEWAY}/patient/vaccinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Save failed (${res.status})`);
      }
      setItems((prev) => [payload.item, ...prev]);
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      console.error('vaccination save failed', err);
      setError(err.message || 'Failed to save vaccination');
    } finally {
      setSaving(false);
    }
  }

  const today = startOfToday();

  const derivedLists = useMemo(() => {
    const past: Vaccination[] = [];
    const upcoming: Vaccination[] = [];
    const all = [...items];

    for (const v of items) {
      if (v.followupAt) {
        const d = new Date(v.followupAt);
        if (isAfter(d, today)) {
          upcoming.push(v);
        } else {
          past.push(v);
        }
      } else if (v.date) {
        const d = new Date(v.date);
        if (isBefore(d, today)) {
          past.push(v);
        } else {
          upcoming.push(v);
        }
      } else {
        past.push(v);
      }
    }

    return { all, past, upcoming };
  }, [items, today]);

  const tabItems = useMemo(() => {
    if (activeTab === 'all') return derivedLists.all;
    if (activeTab === 'past') return derivedLists.past;
    return derivedLists.upcoming;
  }, [activeTab, derivedLists]);

  function openSchedule(v: Vaccination) {
    setScheduleTarget(v);
    setScheduleDate(v.followupAt ? toLocal(v.followupAt) : '');
    setScheduleNotes(v.followupLabel || '');
  }

  async function handleScheduleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleTarget || !GATEWAY) return;
    if (!scheduleDate.trim()) {
      alert('Select a follow-up / booster date');
      return;
    }
    setScheduleSaving(true);
    try {
      const body = {
        followupAt: scheduleDate,
        followupLabel: scheduleNotes || undefined,
      };
      const res = await fetch(
        `${GATEWAY}/patient/vaccinations/${encodeURIComponent(
          scheduleTarget.id
        )}/schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Schedule failed (${res.status})`);
      }
      setItems((prev) =>
        prev.map((v) =>
          v.id === scheduleTarget.id ? { ...v, ...payload.item } : v
        )
      );
      setScheduleTarget(null);
      setScheduleDate('');
      setScheduleNotes('');
    } catch (err: any) {
      console.error('schedule followup failed', err);
      alert(err.message || 'Failed to schedule follow-up');
    } finally {
      setScheduleSaving(false);
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            My Vaccinations
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Keep a complete record of your vaccinations and schedule boosters so
            you never miss an important dose.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <button
          onClick={() => {
            if (!showForm) resetForm();
            setShowForm((o) => !o);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-indigo-700 transition"
        >
          <FiPlus className="h-4 w-4" />
          {showForm ? 'Close' : 'Add Vaccination'}
        </button>
      </header>

      {/* Tabs */}
      <section className="rounded-2xl border bg-white/80 backdrop-blur shadow-sm">
        <div className="border-b px-4 pt-3">
          <nav className="flex gap-4 text-sm">
            {(['all', 'past', 'upcoming'] as TabKey[]).map((tab) => {
              const isActive = activeTab === tab;
              const label =
                tab === 'all'
                  ? 'All vaccinations'
                  : tab === 'past'
                  ? 'Past doses'
                  : 'Upcoming / scheduled';
              const badgeCount =
                tab === 'all'
                  ? derivedLists.all.length
                  : tab === 'past'
                  ? derivedLists.past.length
                  : derivedLists.upcoming.length;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-3 px-1 -mb-px border-b-2 ${
                    isActive
                      ? 'border-indigo-600 text-indigo-700 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span>{label}</span>
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-gray-100 text-[10px] px-2 py-0.5 text-gray-600">
                    {badgeCount}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Add form inside tab container for coherence */}
        {showForm && (
          <div className="px-4 pb-4 pt-3 border-b bg-gray-50/60">
            <form
              onSubmit={handleSubmit}
              className="grid md:grid-cols-2 gap-3 text-sm"
            >
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Vaccine name *
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. COVID-19 (Pfizer), Yellow Fever, Hepatitis B"
                  value={form.vaccine}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, vaccine: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Batch / Lot
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Batch / Lot number"
                  value={form.batch}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, batch: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Administered by
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Clinician / nurse"
                  value={form.clinician}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      clinician: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Facility</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Clinic / hospital / vaccination site"
                  value={form.facility}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, facility: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Notes (e.g. side effects, dose number, schedule)
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[70px]"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 rounded-full border bg-white text-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save vaccination'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab content */}
        <div className="p-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading vaccinations…</div>
          ) : tabItems.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-gray-50/80 p-6 text-center text-sm text-gray-500">
              No vaccinations in this view yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tabItems.map((v) => (
                <article
                  key={v.id}
                  className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {v.vaccine}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v.date ? toLocal(v.date) : 'Date not recorded'}
                        {v.batch && <> • Batch {v.batch}</>}
                      </p>
                    </div>
                    {v.followupAt && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <FiClock className="mr-1 h-3 w-3" />
                        Follow-up
                      </span>
                    )}
                  </div>

                  {(v.facility || v.clinician) && (
                    <p className="text-xs text-gray-500">
                      {v.facility && <span>Facility: {v.facility}</span>}
                      {v.facility && v.clinician && <span> • </span>}
                      {v.clinician && <span>Clinician: {v.clinician}</span>}
                    </p>
                  )}

                  {v.notes && (
                    <p className="text-xs text-gray-700 line-clamp-3">{v.notes}</p>
                  )}

                  {v.followupAt && (
                    <p className="text-xs text-indigo-700 flex items-center gap-1 mt-1">
                      <FiCalendar className="h-3 w-3" />
                      Booster scheduled for {toLocal(v.followupAt)}
                      {v.followupLabel && <> — {v.followupLabel}</>}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {v.fileName && (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                          Certificate: {v.fileName}
                        </span>
                      )}
                      {v.ehrTxId && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          EHR anchored
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[11px] text-gray-500 hover:text-gray-700"
                        onClick={() =>
                          alert('Vaccination editing coming soon (inline drawer).')
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-indigo-600 hover:text-indigo-700"
                        onClick={() => openSchedule(v)}
                      >
                        Schedule follow-up
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Schedule follow-up modal */}
      {scheduleTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <form
            onSubmit={handleScheduleSave}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 space-y-3"
          >
            <h2 className="text-lg font-semibold">
              Schedule follow-up / booster
            </h2>
            <p className="text-xs text-gray-500">
              {scheduleTarget.vaccine}
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Follow-up date *
              </label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Notes (e.g. &ldquo;Dose 3 of 3&rdquo;, &ldquo;Annual booster&rdquo;)
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[70px]"
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setScheduleTarget(null);
                  setScheduleDate('');
                  setScheduleNotes('');
                }}
                className="px-3 py-2 rounded-full border text-sm bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduleSaving}
                className="px-3 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium disabled:opacity-60"
              >
                {scheduleSaving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
