'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FiPlus, FiClock } from 'react-icons/fi';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

type Operation = {
  id: string;
  title: string;
  date?: string | null;
  facility?: string | null;
  surgeon?: string | null;
  surgeonId?: string | null;
  coClinicians?: string[] | null;
  clinicianCount?: number | null;
  notes?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  followupAt?: string | null;
  followupLabel?: string | null;
  ehrTxId?: string | null;
};

type ClinicianLite = {
  id: string;
  name: string;
  specialty?: string;
};

function toLocal(iso?: string | null) {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return iso ?? '';
  }
}

export default function PatientOperationsPage() {
  const [items, setItems] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    date: '',
    facility: '',
    surgeonMode: 'platform' as 'platform' | 'external',
    surgeonId: '',
    surgeonName: '',
    coClinicians: '',
    clinicianCount: '',
    notes: '',
  });

  const [clinicians, setClinicians] = useState<ClinicianLite[]>([]);
  const [clinSearch, setClinSearch] = useState('');
  const [clinDropdownOpen, setClinDropdownOpen] = useState(false);

  // follow-up
  const [scheduleTarget, setScheduleTarget] = useState<Operation | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadOps() {
      if (!GATEWAY) {
        setError('Gateway origin not configured');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${GATEWAY}/patient/operations`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => ({ items: [] }));
        if (!mounted) return;
        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (err: any) {
        console.error('operations load failed', err);
        if (mounted) setError(err.message || 'Failed to load operations');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadClinicians() {
      try {
        const res = await fetch('/api/clinicians', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        const mapped: ClinicianLite[] = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id ?? c.userId ?? c.clinicianId ?? String(c.slug ?? c.code ?? 'cl'),
          name: c.name ?? c.fullName ?? c.displayName ?? 'Clinician',
          specialty: c.specialty ?? c.specialisation ?? '',
        }));
        if (mounted) setClinicians(mapped);
      } catch {
        // ignore
      }
    }

    loadOps();
    loadClinicians();

    return () => {
      mounted = false;
    };
  }, []);

  function resetForm() {
    setForm({
      title: '',
      date: '',
      facility: '',
      surgeonMode: 'platform',
      surgeonId: '',
      surgeonName: '',
      coClinicians: '',
      clinicianCount: '',
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
    if (!form.title.trim()) {
      alert('Enter operation / procedure name');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const coList =
        form.coClinicians
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean) || [];

      const count =
        form.clinicianCount.trim().length > 0
          ? Number(form.clinicianCount)
          : coList.length
          ? coList.length + 1
          : 1;

      const body: any = {
        title: form.title.trim(),
        date: form.date || undefined,
        facility: form.facility || undefined,
        coClinicians: coList,
        clinicianCount: isNaN(count) ? undefined : count,
        notes: form.notes || undefined,
      };

      if (form.surgeonMode === 'platform' && form.surgeonId) {
        body.surgeonId = form.surgeonId;
        body.surgeon = form.surgeonName || undefined;
      } else if (form.surgeonName) {
        body.surgeon = form.surgeonName;
      }

      const res = await fetch(`${GATEWAY}/patient/operations`, {
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
      console.error('operation save failed', err);
      setError(err.message || 'Failed to save operation');
    } finally {
      setSaving(false);
    }
  }

  const matchedClinicians = useMemo(() => {
    if (!clinSearch.trim()) return clinicians.slice(0, 8);
    const term = clinSearch.toLowerCase();
    return clinicians
      .filter((c) => c.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [clinSearch, clinicians]);

  function pickClinician(c: ClinicianLite) {
    setForm((prev) => ({
      ...prev,
      surgeonId: c.id,
      surgeonName: c.name,
      surgeonMode: 'platform',
    }));
    setClinSearch(c.name);
    setClinDropdownOpen(false);
  }

  function openSchedule(op: Operation) {
    setScheduleTarget(op);
    setScheduleDate(op.followupAt ? toLocal(op.followupAt) : '');
    setScheduleNotes(op.followupLabel || '');
  }

  async function handleScheduleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleTarget || !GATEWAY) return;
    if (!scheduleDate.trim()) {
      alert('Select a follow-up date');
      return;
    }
    setScheduleSaving(true);
    try {
      const body = {
        followupAt: scheduleDate,
        followupLabel: scheduleNotes || undefined,
      };
      const res = await fetch(
        `${GATEWAY}/patient/operations/${encodeURIComponent(
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
        prev.map((o) =>
          o.id === scheduleTarget.id ? { ...o, ...payload.item } : o
        )
      );
      setScheduleTarget(null);
      setScheduleDate('');
      setScheduleNotes('');
    } catch (err: any) {
      console.error('follow-up schedule failed', err);
      alert(err.message || 'Failed to schedule follow-up');
    } finally {
      setScheduleSaving(false);
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            My Operations &amp; Procedures
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Record surgeries and procedures you&apos;ve had, and schedule
            follow-ups so your care team always has context.
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
          {showForm ? 'Close' : 'Record Operation'}
        </button>
      </header>

      {showForm && (
        <section className="rounded-2xl border bg-white shadow-sm p-4 md:p-5 space-y-4">
          <h2 className="text-base md:text-lg font-semibold">
            Add an operation / procedure
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Operation / procedure *
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. Appendicectomy, C-section, Knee arthroscopy"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Facility
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Hospital / surgical centre / clinic"
                  value={form.facility}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, facility: e.target.value }))
                  }
                />
              </div>
              <div>
                <span className="block text-xs text-gray-500 mb-1">
                  Lead clinician
                </span>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        surgeonMode: 'platform',
                        surgeonName: prev.surgeonName,
                      }))
                    }
                    className={`flex-1 rounded-full border px-3 py-1 ${
                      form.surgeonMode === 'platform'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    On Ambulant+
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        surgeonMode: 'external',
                        surgeonId: '',
                      }))
                    }
                    className={`flex-1 rounded-full border px-3 py-1 ${
                      form.surgeonMode === 'external'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    External
                  </button>
                </div>
              </div>
            </div>

            {form.surgeonMode === 'platform' ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Tag lead clinician (Ambulant+)
                </label>
                <div className="relative">
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Start typing to search clinicians"
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
                {form.surgeonId && (
                  <p className="text-xs text-green-600 mt-1">
                    Tagged lead clinician: {form.surgeonName}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Lead clinician / surgeon name
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Name of the clinician who led the procedure"
                  value={form.surgeonName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, surgeonName: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Assisting clinicians (comma separated)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Dr A, Dr B, Anaesthetist C"
                  value={form.coClinicians}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      coClinicians: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Number of clinicians (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="We can calculate this for you"
                  value={form.clinicianCount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      clinicianCount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Notes (indication, complications, outcome, follow-up)
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 min-h-[90px]"
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
                className="px-4 py-2 rounded-full border bg-white text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save operation'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base md:text-lg font-semibold">
          Operation history
        </h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading operations…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-gray-50/80 p-6 text-center text-sm text-gray-500">
            No operations recorded yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((op) => (
              <article
                key={op.id}
                className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {op.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {op.date ? toLocal(op.date) : 'Date not recorded'}
                      {op.facility && <> • {op.facility}</>}
                    </p>
                  </div>
                  {op.followupAt && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <FiClock className="mr-1 h-3 w-3" />
                      Follow-up
                    </span>
                  )}
                </div>

                {(op.surgeon || (op.coClinicians && op.coClinicians.length > 0)) && (
                  <p className="text-xs text-gray-500">
                    {op.surgeon && <span>Lead: {op.surgeon}</span>}
                    {op.coClinicians && op.coClinicians.length > 0 && (
                      <>
                        {' '}
                        · Co-clinicians: {op.coClinicians.join(', ')}
                      </>
                    )}
                  </p>
                )}

                {op.notes && (
                  <p className="text-xs text-gray-700 line-clamp-3">{op.notes}</p>
                )}

                {op.followupAt && (
                  <p className="text-xs text-indigo-700 mt-1">
                    Follow-up scheduled for {toLocal(op.followupAt)}
                    {op.followupLabel && <> — {op.followupLabel}</>}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {op.fileName && (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                        Report: {op.fileName}
                      </span>
                    )}
                    {op.ehrTxId && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        EHR anchored
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[11px] text-indigo-600 hover:text-indigo-700"
                    onClick={() => openSchedule(op)}
                  >
                    Schedule follow-up
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* follow-up modal */}
      {scheduleTarget && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <form
            onSubmit={handleScheduleSave}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 space-y-3"
          >
            <h2 className="text-lg font-semibold">
              Schedule follow-up for procedure
            </h2>
            <p className="text-xs text-gray-500">{scheduleTarget.title}</p>
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
                Notes (e.g. wound check, suture removal)
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
                className="px-3 py-2 rounded-full border bg-white text-sm"
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
