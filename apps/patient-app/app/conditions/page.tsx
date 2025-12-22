'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FiPlus, FiFilter } from 'react-icons/fi';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

type ConditionStatus =
  | 'Active'
  | 'Inactive'
  | 'Controlled'
  | 'Suppressed'
  | 'Remission'
  | 'Resolved';

type Condition = {
  id: string;
  name: string;
  status: ConditionStatus;
  diagnosedAt?: string | null;
  facility?: string | null;
  clinician?: string | null;
  onAmbulant?: boolean | null;
  notes?: string | null;
  taggedClinicianId?: string | null;
  taggedClinicianName?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  ehrTxId?: string | null;
  createdAt?: string;
};

type ClinicianLite = {
  id: string;
  name: string;
  specialty?: string;
};

const STATUS_OPTIONS: ConditionStatus[] = [
  'Active',
  'Controlled',
  'Suppressed',
  'Remission',
  'Inactive',
  'Resolved',
];

function toLocalDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return iso ?? '';
  }
}

export default function PatientConditionsPage() {
  const [items, setItems] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [diagnosisOrigin, setDiagnosisOrigin] = useState<'ambulant' | 'elsewhere'>('ambulant');

  const [form, setForm] = useState({
    name: '',
    status: 'Active' as ConditionStatus,
    diagnosedAt: '',
    facility: '',
    clinicianText: '',
    taggedClinicianId: '',
    taggedClinicianName: '',
    notes: '',
  });

  // Clinician tagging (autocomplete)
  const [clinicians, setClinicians] = useState<ClinicianLite[]>([]);
  const [clinSearch, setClinSearch] = useState('');
  const [clinDropdownOpen, setClinDropdownOpen] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<ConditionStatus | 'all'>('all');
  const [filterOnAmbulant, setFilterOnAmbulant] = useState<'all' | 'yes' | 'no'>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadConditions() {
      if (!GATEWAY) {
        setError('Gateway origin not configured');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${GATEWAY}/patient/conditions`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => ({ items: [] }));
        if (!mounted) return;
        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (err: any) {
        console.error('conditions load failed', err);
        if (mounted) setError(err.message || 'Failed to load conditions');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadClinicians() {
      try {
        // BFF or gateway directory – adjust endpoint as needed
        const res = await fetch('/api/clinicians', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        const mapped: ClinicianLite[] = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id ?? c.userId ?? c.clinicianId ?? String(c.slug ?? c.code ?? c.name ?? 'cl'),
          name: c.name ?? c.fullName ?? c.displayName ?? 'Clinician',
          specialty: c.specialty ?? c.specialisation ?? '',
        }));
        if (mounted) setClinicians(mapped);
      } catch {
        // fail silently – tagging is nice-to-have
      }
    }

    loadConditions();
    loadClinicians();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterOnAmbulant === 'yes' && !c.onAmbulant) return false;
      if (filterOnAmbulant === 'no' && c.onAmbulant) return false;
      if (filterFrom) {
        const d = c.diagnosedAt ? new Date(c.diagnosedAt) : null;
        if (d && d < new Date(filterFrom)) return false;
      }
      if (filterTo) {
        const d = c.diagnosedAt ? new Date(c.diagnosedAt) : null;
        if (d && d > new Date(filterTo)) return false;
      }
      return true;
    });
  }, [items, filterStatus, filterOnAmbulant, filterFrom, filterTo]);

  function resetForm() {
    setDiagnosisOrigin('ambulant');
    setForm({
      name: '',
      status: 'Active',
      diagnosedAt: '',
      facility: '',
      clinicianText: '',
      taggedClinicianId: '',
      taggedClinicianName: '',
      notes: '',
    });
    setClinSearch('');
    setClinDropdownOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!GATEWAY) {
      setError('Gateway origin not configured');
      return;
    }
    if (!form.name.trim()) {
      alert('Please enter condition name');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const body: any = {
        name: form.name.trim(),
        status: form.status,
        diagnosedAt: form.diagnosedAt || undefined,
        onAmbulant: diagnosisOrigin === 'ambulant',
        notes: form.notes || undefined,
      };

      if (diagnosisOrigin === 'ambulant') {
        if (form.taggedClinicianId) {
          body.taggedClinicianId = form.taggedClinicianId;
          body.taggedClinicianName = form.taggedClinicianName || undefined;
        }
      } else {
        body.facility = form.facility || undefined;
        body.clinician = form.clinicianText || undefined;
      }

      const res = await fetch(`${GATEWAY}/patient/conditions`, {
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
      console.error('condition save failed', err);
      setError(err.message || 'Failed to save condition');
    } finally {
      setSaving(false);
    }
  }

  const matchedClinicians = useMemo(() => {
    if (!clinSearch.trim()) return clinicians.slice(0, 8);
    const term = clinSearch.toLowerCase();
    return clinicians.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8);
  }, [clinSearch, clinicians]);

  function pickClinician(c: ClinicianLite) {
    setForm((prev) => ({
      ...prev,
      taggedClinicianId: c.id,
      taggedClinicianName: c.name,
    }));
    setClinSearch(c.name);
    setClinDropdownOpen(false);
  }

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            My Conditions
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Capture long-term conditions, when they were diagnosed and by whom. This forms
            part of your lifelong health passport on Ambulant+.
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
          {showForm ? 'Close' : 'Add Condition'}
        </button>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FiFilter className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-700">History filters</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as ConditionStatus | 'all')
              }
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Diagnosed on Ambulant+
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filterOnAmbulant}
              onChange={(e) =>
                setFilterOnAmbulant(e.target.value as 'all' | 'yes' | 'no')
              }
            >
              <option value="all">All</option>
              <option value="yes">Only on Ambulant+</option>
              <option value="no">Only diagnosed elsewhere</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Diagnosed from
            </label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Diagnosed to</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Add / Edit form (collapsible) */}
      {showForm && (
        <section className="rounded-2xl border bg-white shadow-sm p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base md:text-lg font-semibold">Add a condition</h2>
            <span className="text-xs text-gray-500">
              These details help clinicians make safer decisions.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Condition name *
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as ConditionStatus,
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  When were you first diagnosed?
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.diagnosedAt}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, diagnosedAt: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <span className="block text-xs text-gray-500 mb-1">
                  Where was this condition diagnosed?
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDiagnosisOrigin('ambulant')}
                    className={`px-3 py-1 rounded-full border ${
                      diagnosisOrigin === 'ambulant'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    Diagnosed on Ambulant+
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiagnosisOrigin('elsewhere')}
                    className={`px-3 py-1 rounded-full border ${
                      diagnosisOrigin === 'elsewhere'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    Diagnosed elsewhere
                  </button>
                </div>
              </div>
            </div>

            {/* Origin-specific fields */}
            {diagnosisOrigin === 'ambulant' ? (
              <div className="space-y-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Tag the Ambulant+ clinician (optional)
                </label>
                <div className="relative">
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Start typing to search Ambulant+ clinicians"
                    value={clinSearch}
                    onChange={(e) => {
                      setClinSearch(e.target.value);
                      setClinDropdownOpen(true);
                    }}
                    onFocus={() => setClinDropdownOpen(true)}
                  />
                  {clinDropdownOpen && matchedClinicians.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-auto text-sm">
                      {matchedClinicians.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickClinician(c)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                        >
                          <div className="font-medium">{c.name}</div>
                          {c.specialty && (
                            <div className="text-xs text-gray-500">
                              {c.specialty}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.taggedClinicianId && (
                  <p className="text-xs text-green-600 mt-1">
                    Tagged clinician: {form.taggedClinicianName}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Clinic / Facility name *
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Where were you diagnosed?"
                    value={form.facility}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, facility: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Diagnosing clinician *
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Doctor / nurse who diagnosed you"
                    value={form.clinicianText}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        clinicianText: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Notes for your care team
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
                placeholder="Symptoms, triggers, medications, or anything your clinicians should know."
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 rounded-full border text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium shadow-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save condition'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* History list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold">Condition history</h2>
          <span className="text-xs text-gray-500">
            {filteredItems.length} of {items.length} shown
          </span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading conditions…</div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white/60 p-6 text-center text-sm text-gray-500">
            No conditions recorded yet with these filters. Try clearing filters or
            add your first condition above.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((c) => (
              <article
                key={c.id}
                className="relative rounded-2xl border bg-white p-4 shadow-sm flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {c.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.status}{' '}
                      {c.diagnosedAt && (
                        <>
                          • Diagnosed {toLocalDate(c.diagnosedAt)}
                        </>
                      )}
                    </p>
                  </div>
                  {c.onAmbulant && (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                      Ambulant+
                    </span>
                  )}
                </div>

                {(c.facility || c.clinician) && (
                  <p className="text-xs text-gray-500">
                    {c.facility && <span>Facility: {c.facility}</span>}
                    {c.facility && c.clinician && <span> • </span>}
                    {c.clinician && <span>Clinician: {c.clinician}</span>}
                  </p>
                )}

                {c.taggedClinicianName && (
                  <p className="text-xs text-gray-500">
                    Tagged clinician:{' '}
                    <span className="font-medium">{c.taggedClinicianName}</span>
                  </p>
                )}

                {c.notes && (
                  <p className="text-xs text-gray-700 mt-1 line-clamp-3">
                    {c.notes}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {c.fileName && (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                        Attachment: {c.fileName}
                      </span>
                    )}
                    {c.ehrTxId && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        EHR anchored
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[11px] text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      // future: open side-drawer with full details
                      alert('Full condition timeline view coming soon.');
                    }}
                  >
                    View timeline →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
